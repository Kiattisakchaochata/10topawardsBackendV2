// routes/admin/tracking.admin.routes.js
import express from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRole } from '../../middlewares/role.middleware.js';
import {
  deleteTrackingScript,
  listTrackingScripts,
  upsertTrackingScript,
} from '../../controllers/tracking.controller.js';

const router = express.Router();

/**
 * 🔒 Admin-only routes for tracking scripts
 * Base path: /api/admin/tracking
 */
router.use(authenticate);
router.use(authorizeRole('admin'));

/** GET: list all scripts (global + store-linked) */
router.get('/', listTrackingScripts);

/** POST or PATCH: create/update (upsert by id) */
router.post('/', upsertTrackingScript);
router.patch('/', upsertTrackingScript);

/** DELETE by id */
router.delete('/:id', deleteTrackingScript);

export default router;