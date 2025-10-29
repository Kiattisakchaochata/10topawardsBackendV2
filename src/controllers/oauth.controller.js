// src/controllers/oauth.controller.js
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.config.js'
import { createError } from '../utils/create-error.util.js'

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'token'
const JWT_SECRET = process.env.JWT_SECRET || 'TopAwards'
const IS_PROD = process.env.NODE_ENV === 'production'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID // ต้องตั้งค่า .env
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID // (ออปชัน)
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET // (ออปชัน)

// reCAPTCHA: เปิด/ปิดด้วย env (ปิดค่าเริ่มต้นเพื่อให้โปรดักชันใช้ได้ทันที)
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || null
const FORCE_RECAPTCHA = String(process.env.FORCE_RECAPTCHA || 'false').toLowerCase() === 'true'

/* -------------------- helpers -------------------- */
function issueJwtAndCookie(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
  return token
}

async function upsertOAuthAccountAndUser({ provider, providerAccountId, profile, tokens = {} }) {
  // profile: { email, name, picture, email_verified }
  const email = profile.email?.toLowerCase()
  if (!email) throw createError(400, `ไม่พบอีเมลจาก ${provider === 'GOOGLE' ? 'Google' : 'Facebook'}`)

  const existing = await prisma.user.findUnique({ where: { email } })

  const user = await prisma.$transaction(async (tx) => {
    let u
    if (existing) {
      u = await tx.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name || profile.name || 'User',
          picture: profile.picture ?? existing.picture,
          email_verified: profile.email_verified
            ? existing.email_verified || new Date()
            : existing.email_verified,
        },
      })
    } else {
      u = await tx.user.create({
        data: {
          name: profile.name || 'ผู้ใช้',
          email,
          password_hash: null, // ✅ social ไม่มีรหัสผ่าน
          picture: profile.picture || null,
          email_verified: profile.email_verified ? new Date() : null,
          role: 'USER',
        },
      })
    }

    await tx.oAuthAccount.upsert({
      where: {
        provider_provider_account_id: {
          provider,
          provider_account_id: providerAccountId,
        },
      },
      update: {
        user_id: u.id,
        access_token: tokens.access_token || null,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expires_at || null,
      },
      create: {
        user_id: u.id,
        provider,
        provider_account_id: providerAccountId,
        access_token: tokens.access_token || null,
        refresh_token: tokens.refresh_token || null,
        expires_at: tokens.expires_at || null,
      },
    })

    return tx.user.findUnique({
      where: { id: u.id },
      select: { id: true, name: true, email: true, role: true, picture: true },
    })
  })

  return user
}

/* -------------------- Google: verify (lib-first, tokeninfo-fallback) -------------------- */

// พยายามใช้ google-auth-library ก่อน ถ้าไม่มีแพ็กเกจ จะ fallback อัตโนมัติ
let googleVerifyWithLib = null
;(async () => {
  try {
    const { OAuth2Client } = await import('google-auth-library')
    const gClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    googleVerifyWithLib = async (idToken) => {
      const ticket = await gClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      return ticket.getPayload() // { sub, email, email_verified, name, picture, aud, exp, ... }
    }
    console.log('✅ Using google-auth-library for ID token verification')
  } catch {
    console.log('ℹ️ google-auth-library not installed; will use tokeninfo fallback')
  }
})()

async function verifyGoogleIdTokenFallback(id_token, clientId) {
  const res = await fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(id_token)
  )
  const text = await res.text()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {}

  if (!res.ok) {
    const msg = payload?.error_description || payload?.error || text || 'unknown error'
    throw createError(401, `ตรวจสอบ Google id_token ไม่สำเร็จ: ${msg}`)
  }

  if (!payload?.aud) throw createError(401, 'Google id_token ไม่มีค่า aud')
  if (payload.aud !== clientId)
    throw createError(401, `Google id_token ไม่ตรงกับ client ของเรา (aud=${payload.aud})`)

  const nowSec = Math.floor(Date.now() / 1000)
  if (payload.exp && Number(payload.exp) < nowSec) throw createError(401, 'Google id_token หมดอายุแล้ว')

  return payload
}

async function verifyGoogleIdToken(id_token, clientId) {
  // กันเคสคัดลอกจากหน้าเว็บมีช่องว่าง/บรรทัดใหม่
  const token = String(id_token || '').trim()
  if (!token.includes('.')) {
    // tokeninfo จะตอบ Invalid Value ถ้าไม่ใช่ JWT — โยน error ให้ชัดเลย
    throw createError(401, 'รูปแบบ id_token ไม่ถูกต้อง (ต้องเป็น JWT มีจุด 2 จุด)')
  }

  if (googleVerifyWithLib) {
    try {
      const payload = await googleVerifyWithLib(token)
      return payload
    } catch (e) {
      console.warn('google-auth-library verify failed, falling back to tokeninfo:', e?.message)
    }
  }
  return verifyGoogleIdTokenFallback(token, clientId)
}

/* -------------------- controllers -------------------- */

// POST /api/auth/oauth/google
// body: { id_token?: string, credential?: string, recaptcha_token?: string }
export const oauthGoogle = async (req, res, next) => {
  try {
    const raw = req.body || {}
    const idToken = (raw.id_token || raw.credential || '').trim()
    if (!idToken) return next(createError(400, 'กรุณาส่ง id_token หรือ credential ของ Google'))
    if (!GOOGLE_CLIENT_ID) return next(createError(500, 'ยังไม่ตั้งค่า GOOGLE_CLIENT_ID ใน .env'))

    // (ออปชัน) ตรวจ reCAPTCHA เมื่อถูกบังคับ
    if (FORCE_RECAPTCHA && RECAPTCHA_SECRET) {
      const recaptchaToken = (raw.recaptcha_token || '').trim()
      if (!recaptchaToken) return next(createError(400, 'กรุณาส่ง recaptcha_token'))
      const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: RECAPTCHA_SECRET,
          response: recaptchaToken,
        }),
      })
      const rc = await r.json()
      if (!rc.success) return next(createError(400, 'reCAPTCHA failed'))
    }

    // ✅ verify id token จาก Google
    const payload = await verifyGoogleIdToken(idToken, GOOGLE_CLIENT_ID)
    // payload: { sub, email, email_verified, name, picture, aud, exp, ... }

    const user = await upsertOAuthAccountAndUser({
      provider: 'GOOGLE',
      providerAccountId: payload.sub,
      profile: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        email_verified: Boolean(payload.email_verified),
      },
      tokens: {},
    })

    const token = issueJwtAndCookie(res, user)
    return res.json({ ok: true, message: 'เข้าสู่ระบบด้วย Google สำเร็จ', user, token })
  } catch (err) {
    return next(err)
  }
}

// POST /api/auth/oauth/facebook
// body: { access_token: string }
export const oauthFacebook = async (req, res, next) => {
  try {
    const { access_token } = req.body || {}
    if (!access_token) return next(createError(400, 'กรุณาส่ง access_token ของ Facebook'))

    const fields = 'id,name,email,picture.type(large)'
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(
        access_token
      )}`
    )
    const me = await meRes.json()

    if (me.error) {
      return next(
        createError(401, `Facebook token ไม่ถูกต้อง: ${me.error?.message || 'unknown error'}`)
      )
    }

    if (!me.email) {
      return next(
        createError(400, 'บัญชี Facebook นี้ไม่มีอีเมล โปรดอนุญาตสิทธิ์อีเมลหรือสมัครด้วยวิธีอื่น')
      )
    }

    const picture = typeof me?.picture === 'object' ? me.picture?.data?.url : null

    const user = await upsertOAuthAccountAndUser({
      provider: 'FACEBOOK',
      providerAccountId: String(me.id),
      profile: {
        email: me.email,
        name: me.name,
        picture,
        email_verified: true, // FB ถือว่า verified (ปรับตามนโยบายได้)
      },
      tokens: { access_token },
    })

    const token = issueJwtAndCookie(res, user)
    return res.json({ ok: true, message: 'เข้าสู่ระบบด้วย Facebook สำเร็จ', user, token })
  } catch (err) {
    return next(err)
  }
}