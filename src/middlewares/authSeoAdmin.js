// src/middlewares/authSeoAdmin.js
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.config.js';

const JWT_SECRET = process.env.JWT_SECRET || 'BestTopaward';
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'token';
const ADMIN_TOKEN = process.env.SEO_ADMIN_TOKEN || '';

function readToken(req) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  if (req.cookies?.[AUTH_COOKIE]) return req.cookies[AUTH_COOKIE];
  return null;
}

/**
 * อนุญาตถ้า:
 * 1) Authorization = Bearer <SEO_ADMIN_TOKEN>  (service token)  หรือ
 * 2) JWT ผู้ใช้ที่ role === 'admin'
 */
export async function authSeoAdmin(req, res, next) {
  // เคส 1: service token
  const header = req.headers.authorization || '';
  if (ADMIN_TOKEN && header.startsWith('Bearer ') && header.slice(7) === ADMIN_TOKEN) {
    return next();
  }

  // เคส 2: JWT ผู้ใช้ (admin)
  try {
    const token = readToken(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true },
    });
    if (user?.role === 'admin') return next();

    return res.status(403).json({ message: 'Forbidden' });
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}