import * as yup from 'yup'

// ✅ สมัครสมาชิกปกติ
export const registerSchema = yup.object({
  name: yup.string().required('กรุณาระบุชื่อ'),
  email: yup
    .string()
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .required('กรุณาระบุอีเมล'),
  password: yup
    .string()
    .min(6, 'รหัสผ่านต้องมากกว่า 6 ตัวอักษร')
    .required('กรุณาระบุรหัสผ่าน'),
})

// ✅ เข้าสู่ระบบปกติ
export const loginSchema = yup.object({
  email: yup
    .string()
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .required('กรุณาระบุอีเมล'),
  password: yup.string().required('กรุณาระบุรหัสผ่าน'),
})

/**
 * ✅ เข้าสู่ระบบด้วย Google OAuth
 * - รองรับ code (Auth Code Flow), id_token (Google Sign-In), credential (Google One Tap)
 * - reCAPTCHA เป็นออปชัน
 */
export const googleOAuthSchema = yup
  .object({
    code: yup
      .string()
      .transform(v => (typeof v === 'string' ? v.trim() : v))
      .min(10)
      .optional(),

    id_token: yup
      .string()
      .transform(v => (typeof v === 'string' ? v.trim() : v))
      .min(10)
      .optional(),

    credential: yup
      .string()
      .transform(v => (typeof v === 'string' ? v.trim() : v))
      .min(10)
      .optional(),

    recaptcha_token: yup
      .string()
      .transform(v => (typeof v === 'string' ? v.trim() : v))
      .min(10)
      .optional(),

    action: yup.string().oneOf(['login']).optional(),
  })
  .test(
    'one-of-required',
    'กรุณาส่ง code หรือ id_token หรือ credential ของ Google',
    v => !!(v?.code || v?.id_token || v?.credential)
  )

// ✅ เข้าสู่ระบบด้วย Facebook OAuth
export const facebookOAuthSchema = yup.object({
  access_token: yup
    .string()
    .transform(v => (typeof v === 'string' ? v.trim() : v))
    .required('กรุณาส่ง access_token ของ Facebook'),
})