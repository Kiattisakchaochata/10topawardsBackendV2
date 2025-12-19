// src/controllers/oauth.controller.js
import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.config.js'
import { createError } from '../utils/create-error.util.js'

const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'token'
const JWT_SECRET = process.env.JWT_SECRET || 'TopAwards'
const IS_PROD = process.env.NODE_ENV === 'production'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID // ต้องตั้งค่า .env
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID // (ออปชัน)
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET // (ออปชัน)

// reCAPTCHA: เปิด/ปิดด้วย env (ปิดค่าเริ่มต้นเพื่อให้โปรดักชันใช้ได้ทันที)
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || null
const FORCE_RECAPTCHA = String(process.env.FORCE_RECAPTCHA || 'false').toLowerCase() === 'true'

// 👀 log config แบบคร่าว ๆ (ไม่โชว์ secret จริง)
console.log('🔧 [OAuth CONFIG]', {
  NODE_ENV: process.env.NODE_ENV,
  GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID ? '(set)' : '(missing)',
  GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET ? '(set)' : '(missing)',
  AUTH_COOKIE,
  RECAPTCHA_SECRET: !!RECAPTCHA_SECRET,
  FORCE_RECAPTCHA,
})

/* -------------------- helpers -------------------- */
function issueJwtAndCookie(res, user) {
  console.log('📦 [issueJwtAndCookie] issuing token for user', {
    id: user?.id,
    email: user?.email,
    role: user?.role,
    IS_PROD,
    AUTH_COOKIE,
  })

  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  console.log('✅ [issueJwtAndCookie] cookie set successfully')
  return token
}

async function upsertOAuthAccountAndUser({ provider, providerAccountId, profile, tokens = {} }) {
  console.log('👤 [upsertOAuthAccountAndUser] start', {
    provider,
    providerAccountId,
    profileEmail: profile?.email,
    profileName: profile?.name,
  })

  // profile: { email, name, picture, email_verified }
  const email = profile.email?.toLowerCase()
  if (!email) {
    console.error('❌ [upsertOAuthAccountAndUser] missing email from provider profile')
    throw createError(400, `ไม่พบอีเมลจาก ${provider === 'GOOGLE' ? 'Google' : 'Facebook'}`)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  console.log('ℹ️ [upsertOAuthAccountAndUser] existing user?', !!existing)

  const user = await prisma.$transaction(async (tx) => {
    let u
    if (existing) {
      console.log('✏️ [upsertOAuthAccountAndUser] updating existing user', existing.id)
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
      console.log('🆕 [upsertOAuthAccountAndUser] creating new user for email', email)
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

    console.log('🔗 [upsertOAuthAccountAndUser] upsert OAuthAccount', {
      userId: u.id,
      provider,
      providerAccountId,
    })

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

  console.log('✅ [upsertOAuthAccountAndUser] done for user', {
    id: user.id,
    email: user.email,
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
  } catch (e) {
    console.log('ℹ️ google-auth-library not installed; will use tokeninfo fallback', e?.message)
  }
})()

async function verifyGoogleIdTokenFallback(id_token, clientId) {
  console.log('🪪 [verifyGoogleIdTokenFallback] start')

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
    console.error('❌ [verifyGoogleIdTokenFallback] tokeninfo error', msg)
    throw createError(401, `ตรวจสอบ Google id_token ไม่สำเร็จ: ${msg}`)
  }

  if (!payload?.aud) throw createError(401, 'Google id_token ไม่มีค่า aud')
  if (payload.aud !== clientId)
    throw createError(401, `Google id_token ไม่ตรงกับ client ของเรา (aud=${payload.aud})`)

  const nowSec = Math.floor(Date.now() / 1000)
  if (payload.exp && Number(payload.exp) < nowSec) {
    console.error('❌ [verifyGoogleIdTokenFallback] id_token expired', {
      exp: payload.exp,
      nowSec,
    })
    throw createError(401, 'Google id_token หมดอายุแล้ว')
  }

  console.log('✅ [verifyGoogleIdTokenFallback] verified payload for sub', payload.sub)
  return payload
}

async function verifyGoogleIdToken(id_token, clientId) {
  console.log('🪪 [verifyGoogleIdToken] start verify id_token')

  // กันเคสคัดลอกจากหน้าเว็บมีช่องว่าง/บรรทัดใหม่
  const token = String(id_token || '').trim()
  if (!token.includes('.')) {
    console.error('❌ [verifyGoogleIdToken] id_token format invalid (no dots)')
    throw createError(401, 'รูปแบบ id_token ไม่ถูกต้อง (ต้องเป็น JWT มีจุด 2 จุด)')
  }

  if (googleVerifyWithLib) {
    try {
      const payload = await googleVerifyWithLib(token)
      console.log('✅ [verifyGoogleIdToken] verified via google-auth-library, sub=', payload.sub)
      return payload
    } catch (e) {
      console.warn(
        '⚠️ [verifyGoogleIdToken] google-auth-library verify failed, fallback to tokeninfo:',
        e?.message
      )
    }
  }
  return verifyGoogleIdTokenFallback(token, clientId)
}

// แลก authorization code เป็น access_token / id_token
async function exchangeCodeForTokens(code) {
  console.log('🔄 [exchangeCodeForTokens] exchanging code with Google...')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'postmessage', // สำหรับ SPA / desktop flow
    }),
  })

  // อ่านเป็นข้อความก่อนเพื่อ log error ได้
  const text = await r.text().catch(() => '')
  if (!r.ok) {
    console.error('❌ [exchangeCodeForTokens] Google token error', {
      status: r.status,
      body: text,
    })
    throw createError(400, 'แลก code เป็น token ไม่สำเร็จ: ' + text)
  }

  try {
    const json = JSON.parse(text) // { access_token, id_token, expires_in, ... }
    console.log('✅ [exchangeCodeForTokens] got token payload from Google', {
      hasAccessToken: !!json.access_token,
      hasIdToken: !!json.id_token,
    })
    return json
  } catch {
    console.error('❌ [exchangeCodeForTokens] invalid JSON from Google:', text)
    throw createError(400, 'รูปแบบ token response ไม่ถูกต้อง: ' + text)
  }
}

/* -------------------- controllers -------------------- */

// POST /api/auth/oauth/google
// body: { id_token?: string, credential?: string, recaptcha_token?: string }
export const oauthGoogle = async (req, res, next) => {
  console.log('🚀 [oauthGoogle] incoming request body:', req.body)

  try {
    const raw = req.body || {}

    // รับค่าได้ 3 ทาง: code | id_token | credential
    let code = String(raw.code || '').trim()
    let idToken = String(raw.id_token || raw.credential || '').trim()

    console.log('ℹ️ [oauthGoogle] parsed input', {
      hasCode: !!code,
      hasIdToken: !!idToken,
    })

    if (!GOOGLE_CLIENT_ID) {
      console.error('❌ [oauthGoogle] GOOGLE_CLIENT_ID not set')
      return next(createError(500, 'ยังไม่ตั้งค่า GOOGLE_CLIENT_ID ใน .env'))
    }
    if (!GOOGLE_CLIENT_SECRET && code) {
      console.error('❌ [oauthGoogle] GOOGLE_CLIENT_SECRET not set (code flow)')
      return next(createError(500, 'ยังไม่ตั้งค่า GOOGLE_CLIENT_SECRET ใน .env'))
    }

    // (ออปชัน) reCAPTCHA ถ้าบังคับใช้
    if (FORCE_RECAPTCHA && RECAPTCHA_SECRET) {
      const recaptchaToken = (raw.recaptcha_token || '').trim()
      console.log('🔐 [oauthGoogle] verifying reCAPTCHA...', {
        hasRecaptchaToken: !!recaptchaToken,
      })

      if (!recaptchaToken) return next(createError(400, 'กรุณาส่ง recaptcha_token'))

      const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: recaptchaToken }),
      })
      const rc = await r.json().catch(() => ({}))
      console.log('ℹ️ [oauthGoogle] reCAPTCHA response:', rc)
      if (!rc.success) return next(createError(400, 'reCAPTCHA failed'))
    }

    // ถ้าได้ "code" มาก็แลกเป็น tokens เพื่อดึง id_token มา verify
    if (code) {
      console.log('🔄 [oauthGoogle] have code, exchanging with Google...')
      const tokens = await exchangeCodeForTokens(code)
      if (!tokens?.id_token) {
        console.error('❌ [oauthGoogle] no id_token after exchange', tokens)
        return next(createError(400, 'แลก code แล้วไม่พบ id_token จาก Google'))
      }
      idToken = tokens.id_token
    }

    if (!idToken) {
      console.error('❌ [oauthGoogle] no idToken/credential in request')
      return next(createError(400, 'กรุณาส่ง code หรือ id_token หรือ credential ของ Google'))
    }

    console.log('🪪 [oauthGoogle] verifying id_token with Google...')
    const payload = await verifyGoogleIdToken(idToken, GOOGLE_CLIENT_ID)
    console.log('✅ [oauthGoogle] verified id_token, sub=', payload.sub)

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

    console.log('✅ [oauthGoogle] user upserted', {
      id: user.id,
      email: user.email,
    })

    const token = issueJwtAndCookie(res, user)

    console.log('🎉 [oauthGoogle] success, returning response')
    return res.json({ ok: true, message: 'เข้าสู่ระบบด้วย Google สำเร็จ', user, token })
  } catch (err) {
    console.error('❌ [oauthGoogle] unexpected error:', err)
    return next(err)
  }
}

// POST /api/auth/oauth/facebook
// body: { access_token: string }
export const oauthFacebook = async (req, res, next) => {
  console.log('🚀 [oauthFacebook] incoming request body:', req.body)

  try {
    const { access_token } = req.body || {}
    if (!access_token) {
      console.error('❌ [oauthFacebook] missing access_token')
      return next(createError(400, 'กรุณาส่ง access_token ของ Facebook'))
    }

    const fields = 'id,name,email,picture.type(large)'
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(
        access_token
      )}`
    )
    const me = await meRes.json()

    console.log('ℹ️ [oauthFacebook] graph /me response:', me)

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
    console.log('🎉 [oauthFacebook] success for user', { id: user.id, email: user.email })
    return res.json({ ok: true, message: 'เข้าสู่ระบบด้วย Facebook สำเร็จ', user, token })
  } catch (err) {
    console.error('❌ [oauthFacebook] unexpected error:', err)
    return next(err)
  }
}