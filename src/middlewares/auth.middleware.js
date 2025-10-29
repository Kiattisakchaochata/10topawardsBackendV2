import jwt from 'jsonwebtoken'
import prisma from '../config/prisma.config.js'

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'token'
const JWT_SECRET = process.env.JWT_SECRET || 'TopAwards'

// ตรวจสอบ JWT จาก cookie ก่อน แล้วค่อย fallback ไป Authorization header
export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.[AUTH_COOKIE]

    if (!token) {
      const h = req.headers.authorization
      if (h?.startsWith('Bearer ')) token = h.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ message: 'ไม่ได้รับอนุญาต (ไม่มีโทเค็น)' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    if (!decoded?.id) {
      return res.status(401).json({ message: 'โทเค็นไม่ถูกต้อง' })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, role: true },
    })
    if (!user) return res.status(401).json({ message: 'ไม่พบผู้ใช้งาน' })

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Token ไม่ถูกต้องหรือหมดอายุ' })
  }
}

// (ออปชัน) ใช้ป้องกันเฉพาะ role
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง' })
  }
  next()
}