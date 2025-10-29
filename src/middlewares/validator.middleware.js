import { ValidationError } from 'yup'
import { createError } from '../utils/create-error.util.js'

export const validate = (schema) => async (req, res, next) => {
  try {
    const contentType = req.headers['content-type'] || ''
    const isMultipart = contentType.includes('multipart/form-data')

    // ✅ ตรวจเฉพาะ field ที่เราต้องการจาก req.body ถ้าเป็น multipart/form-data
    const dataToValidate = isMultipart
      ? { name: req.body.name } // ตรวจเฉพาะ field ที่เป็น text
      : req.body

    const validated = await schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
    })

    req.body = { ...req.body, ...validated } // ผสานข้อมูล validated ลง req.body
    next()
  } catch (error) {
    if (error instanceof ValidationError) {
      const errors = error.inner.map(e => ({
        path: e.path,
        message: e.message,
      }))
      return next(createError(400, 'Validation failed', errors))
    }
    next(error)
  }
}