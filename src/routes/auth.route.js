//src/routes/auth.route.js
import express from 'express'
import {
  register,
  login,
  getMe,
  logout,
  changePassword
} from '../controllers/auth.controller.js'

import {
  oauthGoogle,
  oauthFacebook
} from '../controllers/oauth.controller.js' // ✅ เพิ่ม import controller ใหม่

import { validate } from '../middlewares/validator.middleware.js'
import {
  registerSchema,
  loginSchema,
  googleOAuthSchema,
  facebookOAuthSchema // ✅ import schema เพิ่ม
} from '../validations/auth.validation.js'

import { authenticate } from '../middlewares/auth.middleware.js'

const router = express.Router()

// ✅ สมัครสมาชิก / เข้าสู่ระบบ ปกติ
router.post('/register', validate(registerSchema), register)
router.post('/login', validate(loginSchema), login)
router.get('/me', authenticate, getMe)
router.post('/logout', authenticate, logout)

// ✅ เข้าสู่ระบบผ่าน Google
router.post('/oauth/google', validate(googleOAuthSchema), oauthGoogle)

// ✅ เข้าสู่ระบบผ่าน Facebook
router.post('/oauth/facebook', validate(facebookOAuthSchema), oauthFacebook)

// ✅ เปลี่ยนรหัสผ่าน (ต้องล็อกอินก่อน)
router.post('/change-password', authenticate, changePassword)
router.patch('/password', authenticate, changePassword)

export default router