import * as yup from 'yup'

export const categorySchema = yup.object().shape({
  name: yup.string().required('กรุณาระบุชื่อหมวดหมู่'),
  // image_url: yup.string().url('URL รูปภาพไม่ถูกต้อง').optional()
})