// src/routes/public/storeFeedback.public.route.js
import express from 'express';
import { createStoreFeedback } from '../../controllers/storeFeedback.controller.js';

const router = express.Router();

router.post('/stores/:slug/feedback', createStoreFeedback);

export default router;