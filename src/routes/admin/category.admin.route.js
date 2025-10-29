// src/routes/admin/category.admin.route.js
import express from 'express';
import {
  createCategory,
  deleteCategory,
  updateCategory,
  getAllCategoriesAdmin,
  getCategoryByIdAdmin,
} from '../../controllers/category.controller.js';

import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRole } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validator.middleware.js';
import { categorySchema } from '../../validations/category.validation.js';

// ✅ ใช้ตัวใหม่ที่รับได้ทั้ง 'cover' และ 'cover_image'
import { categoryUploadSingleCoverFlexible } from '../../middlewares/upload.middleware.js';

const router = express.Router();

// GET: ทั้งหมด
router.get('/', authenticate, authorizeRole('admin'), getAllCategoriesAdmin);

// GET: รายตัว
router.get('/:id', authenticate, authorizeRole('admin'), getCategoryByIdAdmin);

// POST: สร้าง (พร้อมอัปโหลดรูปเดี่ยว)
router.post(
  '/',
  authenticate,
  authorizeRole('admin'),
  categoryUploadSingleCoverFlexible,  // ✅ ต้องมาก่อน validate
  validate(categorySchema),
  createCategory
);

// PATCH: แก้ไข (พร้อมอัปโหลดรูปเดี่ยว)
router.patch(
  '/:id',
  authenticate,
  authorizeRole('admin'),
  categoryUploadSingleCoverFlexible,  // ✅ ต้องมาก่อน validate
  validate(categorySchema),
  updateCategory
);

// DELETE: ลบ
router.delete('/:id', authenticate, authorizeRole('admin'), deleteCategory);

export default router;