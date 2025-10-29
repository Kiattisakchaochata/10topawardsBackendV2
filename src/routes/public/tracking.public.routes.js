// routes/public/tracking.public.routes.js
import express from 'express';
import { listEnabledTrackingScripts } from '../../controllers/tracking.controller.js';
const router = express.Router();
router.get('/tracking-scripts', listEnabledTrackingScripts); // GET /api/tracking-scripts?storeId=...
export default router;