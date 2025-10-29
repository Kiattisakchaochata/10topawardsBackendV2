import * as yup from 'yup'

// ✅ สมัครสมาชิกปกติ
export const registerSchema = yup.object({
  name: yup.string().required('กรุณาระบุชื่อ'),
  email: yup.string().email('รูปแบบอีเมลไม่ถูกต้อง').required('กรุณาระบุอีเมล'),
  password: yup
    .string()
    .min(6, 'รหัสผ่านต้องมากกว่า 6 ตัวอักษร')
    .required('กรุณาระบุรหัสผ่าน'),
})

// ✅ เข้าสู่ระบบปกติ
export const loginSchema = yup.object({
  email: yup.string().email('รูปแบบอีเมลไม่ถูกต้อง').required('กรุณาระบุอีเมล'),
  password: yup.string().required('กรุณาระบุรหัสผ่าน'),
})

/**
 * ✅ เข้าสู่ระบบด้วย Google OAuth
 * - รองรับทั้ง id_token (Google Sign-In) และ credential (Google One Tap/GSI)
 * - reCAPTCHA เป็นออปชัน (เปิดทีหลังได้)
 */
export const googleOAuthSchema = yup
  .object({
    id_token: yup
      .string()
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(10)
      .optional(),
    credential: yup
      .string()
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(10)
      .optional(),
    recaptcha_token: yup
      .string()
      .transform((v) => (typeof v === 'string' ? v.trim() : v))
      .min(10)
      .optional(),
  })
  .test(
    'one-of-required',
    'กรุณาส่ง id_token หรือ credential ของ Google',
    (val) => !!(val?.id_token || val?.credential)
  )

// ✅ เข้าสู่ระบบด้วย Facebook OAuth
export const facebookOAuthSchema = yup.object({
  access_token: yup
    .string()
    .transform((v) => (typeof v === 'string' ? v.trim() : v))
    .required('กรุณาส่ง access_token ของ Facebook'),
})