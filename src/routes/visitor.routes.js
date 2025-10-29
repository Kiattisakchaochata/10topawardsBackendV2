import express from 'express'
import {
  incrementWebsiteVisitor,
  incrementStoreVisitor,
  getVisitorStats
} from '../controllers/visitor.controller.js'

const router = express.Router()

router.post('/visit/website', incrementWebsiteVisitor)
router.post('/visit/store/:id', incrementStoreVisitor)
router.get('/stats', getVisitorStats)

export default router