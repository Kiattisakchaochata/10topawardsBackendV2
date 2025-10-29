
import express from 'express'
import {
  getAllStores,
  getStoreById,
  searchStore,
  getPopularStores
} from '../../controllers/store.controller.js'

const router = express.Router()

router.get('/search', searchStore) // ✅ ต้องอยู่ก่อน /:id
router.get('/popular', getPopularStores)
router.get('/', getAllStores)
router.get('/:id', getStoreById)


export default router