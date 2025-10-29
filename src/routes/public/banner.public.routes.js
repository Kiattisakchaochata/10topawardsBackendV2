import express from 'express';
import { getActiveBannersPublic } from '../../controllers/banner.controller.js';

const router = express.Router();

// คืนเฉพาะแบนเนอร์ที่ active และอยู่ในช่วงวันแสดงผล
router.get('/', getActiveBannersPublic);

export default router;