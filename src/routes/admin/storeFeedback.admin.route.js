// src/routes/admin/storeFeedback.admin.route.js
import express from 'express';
import { getStoreFeedbackStats, getAllStoreFeedbackSummary } from '../../controllers/storeFeedback.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRole } from '../../middlewares/role.middleware.js';

const router = express.Router();

// ต้องเป็น admin เท่านั้น
router.use(authenticate);
router.use(authorizeRole('admin'));
router.get('/stores/:id/feedback/stats', getStoreFeedbackStats);
router.get('/feedback/summary', getAllStoreFeedbackSummary);


router.get('/stores/:id/feedback/stats', getStoreFeedbackStats);

export default router;