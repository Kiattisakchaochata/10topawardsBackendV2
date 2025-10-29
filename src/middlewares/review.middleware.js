import { createError } from '../utils/create-error.util.js'
import * as yup from 'yup'

export const reviewSchema = yup.object().shape({
  rating: yup.number().min(1).max(5).optional(),
  comment: yup.string().trim().optional()
})

export const validateReview = async (req, res, next) => {
  try {
    const validated = await reviewSchema.validate(req.body, {
      stripUnknown: true
    })

    if (!validated.rating && !validated.comment) {
      return next(createError(400, 'กรุณาใส่คะแนนหรือคอมเมนต์อย่างน้อยหนึ่งอย่าง'))
    }

    req.body = validated
    next()
  } catch (err) {
    return next(createError(400, 'Validation failed: ' + err.message))
  }
}