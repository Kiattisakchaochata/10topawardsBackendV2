// routes/public/seo.public.route.js
import express from 'express';
import { getSitePublic, getPagePublic, listPagesPublic } from '../../controllers/seo.controller.js';

const router = express.Router();

// GET /api/public/seo/site  → ข้อมูล site-wide (title, meta defaults, og defaults)
router.get('/site', async (req, res, next) => {
  try {
    const site = await getSitePublic(); // คืนเฉพาะ field ปลอดภัย
    res.json({ site });
  } catch (e) { next(e); }
});

// GET /api/public/seo/page?path=/stores
router.get('/page', async (req, res, next) => {
  try {
    const path = String(req.query.path || '/');
    const page = await getPagePublic(path); // คืนเฉพาะ field ปลอดภัย
    res.json({ page });
  } catch (e) { next(e); }
});
// GET /api/public/seo/pages → รายการทุกเพจสำหรับโชว์บนหน้า /
router.get('/pages', async (_req, res, next) => {
  try {
    const pages = await listPagesPublic();
    res.json({ pages });
  } catch (e) { next(e); }
});

export default router;