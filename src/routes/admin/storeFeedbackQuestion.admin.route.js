// src/routes/admin/storeFeedbackQuestion.admin.route.js
import express from 'express';
import {
  listStoreFeedbackQuestionsAdmin,
  createStoreFeedbackQuestionAdmin,
  updateStoreFeedbackQuestionAdmin,
  deleteStoreFeedbackQuestionAdmin,
} from '../../controllers/storeFeedbackQuestion.controller.js';

import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRole } from '../../middlewares/role.middleware.js';

const router = express.Router();

// admin only
router.use(authenticate);
router.use(authorizeRole('admin'));

router.get('/stores/:id/feedback/questions', listStoreFeedbackQuestionsAdmin);
router.post('/stores/:id/feedback/questions', createStoreFeedbackQuestionAdmin);

// ✏️ update คำถาม
router.patch(
  '/stores/:id/feedback/questions/:questionId',
  updateStoreFeedbackQuestionAdmin
);

// 🗑️ delete คำถาม
router.delete(
  '/stores/:id/feedback/questions/:questionId',
  deleteStoreFeedbackQuestionAdmin
);


export default router;