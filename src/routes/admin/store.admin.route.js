import express from 'express';
import { getFeedbackSummary } from '../../controllers/admin.feedback.controller.js';
import {
  createStore,
  getAllStores,
  getStoreById,
  getStoreLoyaltyStats,
  updateStore,
  deleteStore,
  deleteStoreImage,
  updateStoreOrder,
  updateStoreCover,
  getExpiringSoonStores,
  getExpiredStores,
  reactivateStore,
  uploadImages,
  renewStore,
  setStoreStatus,
  enableStore,
  disableStore,
} from '../../controllers/store.controller.js';

import {
  storeUpload,
  storeUploadSingleCover,
  upload,
} from '../../middlewares/upload.middleware.js';

import { authenticate } from '../../middlewares/auth.middleware.js';
import { authorizeRole } from '../../middlewares/role.middleware.js';

const router = express.Router();

router.use(authenticate);
router.use(authorizeRole('admin'));

// ---------- Extra endpoints ----------
router.get('/expired', getExpiredStores);           // ?onlyInactive=true เพื่อดูเฉพาะ is_active=false
router.get('/expiring-soon', getExpiringSoonStores);
router.patch('/:id/reactivate', reactivateStore);
// ✅ ต่ออายุร้าน
router.patch('/:id/renew', renewStore);
router.get('/feedback/summary', getFeedbackSummary);

// ---------- CRUD ----------
router.get('/loyalty', getStoreLoyaltyStats);
router.get('/', getAllStores);
router.get('/:id', getStoreById);

router.post('/', storeUpload, createStore);
router.patch('/:id', storeUpload, updateStore);
router.patch('/cover/:id', storeUploadSingleCover, updateStoreCover);

router.delete('/:id', deleteStore);
router.delete('/images/:imageId', deleteStoreImage);
router.patch('/:id/order', updateStoreOrder);

// ✅ อัปโหลดรูปเพิ่มภายหลัง
router.post('/:id/images', upload.array('images', 5), uploadImages);

// ---------- Status (รองรับ fallback ของ FE) ----------
router.patch('/:id/status', setStoreStatus);
router.patch('/:id/enable', enableStore);
router.patch('/:id/disable', disableStore);

export default router;