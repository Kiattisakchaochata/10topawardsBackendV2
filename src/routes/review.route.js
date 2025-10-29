import express from 'express'
import {
  createReview,
  updateReview,
  deleteReview,
  getReviewById,
  getReviewsForStore
} from '../controllers/review.controller.js'

import { authenticate } from '../middlewares/auth.middleware.js'
import { validateReview } from '../middlewares/review.middleware.js'

const router = express.Router()

// 🟢 Guest: ดูรีวิวของร้าน (ยังใช้ path เต็มเพราะเป็นของ store)
router.get('/stores/:id/reviews', getReviewsForStore)

// 🟢 Guest: ดูรีวิวเดียว
router.get('/:id', getReviewById)

// 🔐 Authenticated: เขียน แก้ไข ลบ
router.post('/:id', authenticate, validateReview, createReview)
router.patch('/:id', authenticate, validateReview, updateReview)
router.delete('/:id', authenticate, deleteReview)

export default router