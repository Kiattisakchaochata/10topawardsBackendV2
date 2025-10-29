// src/routes/admin/banner.routes.ts
import express from 'express';
import multer from 'multer';
import {
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner,
} from '../../controllers/banner.controller.js';

const upload = multer({ dest: 'temp/' });
const router = express.Router();

router.get('/', getBanners);                                 // แอดมินดูทั้งหมด
router.post('/', upload.single('image'), createBanner);      // สร้างใหม่
router.patch('/:id', upload.single('image'), updateBanner);  // ✅ แก้ไข (เลือกรูปใหม่ได้/ไม่ก็ได้)
router.delete('/:id', deleteBanner);                         // ลบ

export default router;