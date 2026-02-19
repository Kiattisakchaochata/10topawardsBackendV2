// src/routes/public/storeFeedback.public.route.js
import express from 'express';
import {
  createStoreFeedback,
  listStoreFeedbackPublic,
  getStoreFeedbackStatsPublic,
  listStoreFeedbackQuestionsPublic,
} from '../../controllers/storeFeedback.controller.js';

const router = express.Router();

// POST (ส่งคำตอบ)
router.post('/stores/:slug/feedback', createStoreFeedback);

// ✅ NEW: ดึง “คำถามของร้าน” เพื่อเอาไป render ฟอร์ม (QR / public)
router.get('/stores/:slug/feedback/questions', listStoreFeedbackQuestionsPublic);

// list feedback ของร้าน (โชว์ในหน้า store)
router.get('/stores/:slug/feedback', listStoreFeedbackPublic);

// stats ของร้าน
router.get('/stores/:slug/feedback/stats', getStoreFeedbackStatsPublic);

export default router;