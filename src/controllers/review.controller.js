// src/controllers/review.controller.js
import prisma from '../config/prisma.config.js'
import { createError } from '../utils/create-error.util.js'

// ===== helper: คำนวณ average & count ของร้าน =====
async function getStoreReviewStats(store_id) {
  const agg = await prisma.review.aggregate({
    where: { store_id },
    _avg: { rating: true },
    _count: { _all: true },
  })

  const average = Number(agg?._avg?.rating ?? 0)
  const count = Number(agg?._count?._all ?? 0)
  return {
    average: count > 0 ? Number(average.toFixed(2)) : 0,
    count,
  }
}

// ✅ ดึงรีวิวตาม ID
export const getReviewById = async (req, res, next) => {
  try {
    const { id } = req.params

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } }
      }
    })

    if (!review) return next(createError(404, 'ไม่พบรีวิวนี้'))

    res.json(review)
  } catch (err) {
    next(err)
  }
}

// ✅ POST /reviews/:id → สร้างรีวิว (id = store_id)
export const createReview = async (req, res, next) => {
  try {
    const { id: store_id } = req.params
    const { rating, comment } = req.body
    const user_id = req.user.id

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return next(createError(400, 'กรุณาระบุคะแนน 1–5'))
    }

    const review = await prisma.review.create({
      data: {
        rating,
        comment: comment || '',
        user: { connect: { id: user_id } },
        store: { connect: { id: store_id } }
      },
      include: { user: { select: { id: true, name: true } } }
    })

    // คำนวณ stats ของร้านหลังเพิ่มรีวิว
    const stats = await getStoreReviewStats(store_id)

    res.status(201).json({ message: 'รีวิวสำเร็จ', review, stats })
  } catch (err) {
    next(err)
  }
}

// ✅ PATCH /reviews/:id → แก้ไขเฉพาะของตัวเอง
export const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params
    const { rating, comment } = req.body
    const user_id = req.user.id

    const existingReview = await prisma.review.findUnique({ where: { id } })

    if (!existingReview) return next(createError(404, 'ไม่พบรีวิวนี้'))
    if (existingReview.user_id !== user_id) {
      return next(createError(403, 'ไม่มีสิทธิ์แก้ไขรีวิวนี้'))
    }

    if (rating !== undefined) {
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return next(createError(400, 'กรุณาระบุคะแนน 1–5'))
      }
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: {
        rating: rating ?? existingReview.rating,
        comment: comment ?? existingReview.comment
      },
      include: { user: { select: { id: true, name: true } } }
    })

    // คำนวณ stats ของร้านหลังแก้ไขรีวิว
    const stats = await getStoreReviewStats(existingReview.store_id)

    res.json({ message: 'อัปเดตรีวิวแล้ว', review: updatedReview, stats })
  } catch (err) {
    next(err)
  }
}

// ✅ DELETE /reviews/:id → ลบเฉพาะของตัวเอง
export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params
    const user_id = req.user.id

    const existingReview = await prisma.review.findUnique({ where: { id } })

    if (!existingReview) return next(createError(404, 'ไม่พบรีวิวนี้'))
    if (existingReview.user_id !== user_id) {
      return next(createError(403, 'ไม่มีสิทธิ์ลบรีวิวนี้'))
    }

    await prisma.review.delete({ where: { id } })

    // คำนวณ stats ของร้านหลังลบรีวิว
    const stats = await getStoreReviewStats(existingReview.store_id)

    res.json({ message: 'ลบรีวิวเรียบร้อยแล้ว', stats })
  } catch (err) {
    next(err)
  }
}

// ✅ GET /stores/:id/reviews → ดูรีวิวของร้าน + stats
export const getReviewsForStore = async (req, res, next) => {
  try {
    const { id: store_id } = req.params

    const reviews = await prisma.review.findMany({
      where: { store_id },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { created_at: 'desc' }
    })

    const stats = await getStoreReviewStats(store_id)

    res.json({ store_id, reviews, stats })
  } catch (err) {
    next(err)
  }
}