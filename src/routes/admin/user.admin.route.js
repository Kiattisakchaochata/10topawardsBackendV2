// routes/admin/user.admin.route.js
import express from 'express'
import { getAllUsers } from '../../controllers/user.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorizeRole } from '../../middlewares/role.middleware.js'

const router = express.Router()

router.get('/', authenticate, authorizeRole('admin'), getAllUsers)

export default router