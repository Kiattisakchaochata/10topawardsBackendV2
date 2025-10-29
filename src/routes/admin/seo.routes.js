import { Router } from 'express';
import {
  getSiteSeo,
  upsertSiteSeo,
  listPageSeo,
  getPageSeoByPath,
  upsertPageSeo,
  deletePageSeo,
} from '../../controllers/seo.controller.js';

const router = Router();

/* ---------- Global (SiteSeo) ---------- */
router.get('/site', getSiteSeo);
router.put('/site', upsertSiteSeo);
router.post('/site', upsertSiteSeo);
router.patch('/site', upsertSiteSeo); // รองรับ PATCH ด้วย

/* ---------- Pages (PageSeo) ---------- */
router.get('/pages', listPageSeo);
router.get('/page', getPageSeoByPath);        // GET /page?path=/about
router.put('/page', upsertPageSeo);
router.post('/page', upsertPageSeo);
router.patch('/page', upsertPageSeo);
router.delete('/page/:id', deletePageSeo);    // ลบตาม id (ตรงกับ FE)

export default router;