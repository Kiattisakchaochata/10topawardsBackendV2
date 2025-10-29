// ✅ src/routes/admin/image.admin.route.js
import express from 'express'
import { deleteImage, reorderImages, uploadSeoImage } from '../../controllers/image.controller.js' // ← เพิ่ม uploadSeoImage
import { authenticate } from '../../middlewares/auth.middleware.js'
import { authorizeRole } from '../../middlewares/role.middleware.js'
import { upload } from '../../middlewares/upload.middleware.js' // ← เพิ่ม upload (multer)

const router = express.Router()

router.use(authenticate)
router.use(authorizeRole('admin'))

// ✅ เพิ่ม route สำหรับอัปโหลดรูป SEO (OG Picker)
router.post('/seo', upload.single('file'), uploadSeoImage)

router.delete('/:id', deleteImage)
router.patch('/reorder/:store_id', reorderImages)

export default router