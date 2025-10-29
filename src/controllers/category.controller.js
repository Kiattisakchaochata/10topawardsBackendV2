import prisma from '../config/prisma.config.js'
import cloudinary from '../config/cloudinary.config.js'
import fs from 'fs/promises'
import { Prisma } from '@prisma/client'

// —————————————————————— helpers ——————————————————————
function toInt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
function json(res, status, body) {
  return res.status(status).json(body)
}
function handlePrismaError(res, err) {
  // P2002 = unique constraint, P2003 = FK constraint
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err?.meta?.target) ? err.meta.target.join(',') : undefined
      const msg = target?.includes('order_number')
        ? 'ลำดับหมวดหมู่นี้ถูกใช้ไปแล้ว'
        : 'ข้อมูลซ้ำ (unique constraint)'
      return json(res, 409, { message: msg })
    }
    if (err.code === 'P2003') {
      return json(res, 409, { message: 'ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่ใช้งานหมวดหมู่นี้อยู่' })
    }
  }
  return json(res, 500, { message: 'เกิดข้อผิดพลาดภายในระบบ', error: err.message })
}

// รวมช่องว่างซ้ำ + ตัดหน้า/หลัง
function normalizeName(raw) {
  return String(raw || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
}

// หา “ชื่อว่าง” โดยเติม (2), (3) … แบบ case-insensitive
async function getAvailableName(baseName) {
  const base = normalizeName(baseName)
  if (!base) return ''
  const rows = await prisma.category.findMany({ select: { name: true } })
  const taken = new Set(rows.map(r => normalizeName(r.name).toLowerCase()))
  for (let i = 1; i <= 200; i++) {
    const candidate = i === 1 ? base : `${base} (${i})`
    const key = normalizeName(candidate).toLowerCase()
    if (!taken.has(key)) return candidate
  }
  return `${base} (${Date.now()})`
}

// หา order_number ที่ “ว่างจริง” (lowest available positive int)
async function getAvailableOrderNumber(pref) {
  const rows = await prisma.category.findMany({ select: { order_number: true } })
  const used = new Set(rows.map(r => r.order_number).filter(n => typeof n === 'number'))
  const start = toInt(pref) || 1
  // ลองจากค่าที่อยากได้ไปเรื่อยๆ
  for (let x = start; x < start + 1000; x++) {
    if (!used.has(x)) return x
  }
  // กันเหนียว
  let candidate = (rows.reduce((m, r) => Math.max(m, r.order_number || 0), 0) || 0) + 1
  while (used.has(candidate)) candidate++
  return candidate
}

function slugify(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .normalize('NFD')           // ตัดวรรณยุกต์
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ก-๙\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// หา slug ที่ไม่ซ้ำในตาราง stores
async function getAvailableStoreSlug(baseName) {
  const base = slugify(baseName);
  if (!base) return String(Date.now());
  // ดึง slug ที่คล้าย ๆ กันออกมาก่อน ลดรอบ query
  const existing = await prisma.store.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(existing.map(r => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i <= 200; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
// —————————————————————— CREATE ——————————————————————
export const createCategory = async (req, res) => {
  try {
    const { name, order_number, image_url, cover_image: coverImageBody } = req.body
    const nameBase = normalizeName(name)
    if (!nameBase) return json(res, 400, { message: 'กรุณาระบุชื่อหมวดหมู่' })

    // ===== รูปภาพ: รองรับทั้งไฟล์อัปโหลดและ URL ที่ส่งมา =====
    let cover_image = null
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'category-covers' })
      cover_image = result.secure_url
      await fs.unlink(req.file.path).catch(() => {})
    } else if (image_url || coverImageBody) {
      cover_image = String(image_url || coverImageBody)
    }

    // ===== เตรียมชื่อ + ลำดับที่ “ว่างจริง” =====
    let finalName = await getAvailableName(nameBase)
    let finalOrderNumber = await getAvailableOrderNumber(order_number)

    // ===== พยายามสร้าง + รีทรายเมื่อชน unique (ทั้ง name และ order_number) =====
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const slug = slugify(finalName)

const category = await prisma.category.create({
  data: {
    name: finalName,
    slug,
    order_number: finalOrderNumber,
    cover_image,
  },
})
        return json(res, 201, { message: 'สร้างหมวดหมู่สำเร็จ', category })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const target = Array.isArray(err?.meta?.target) ? err.meta.target : []
          // ถ้าชื่อชน -> หา candidate ชื่อใหม่
          if (target.includes('name')) {
            finalName = await getAvailableName(finalName)
          }
          // ถ้าลำดับชน -> หาเลขที่ว่างใหม่จากค่าปัจจุบัน + 1
          if (target.includes('order_number')) {
            finalOrderNumber = await getAvailableOrderNumber(finalOrderNumber + 1)
          }
          // ถ้าไม่รู้ว่าอะไรชน (บาง schema ไม่ส่ง meta.target) -> เปลี่ยนทั้งคู่
          if (!target.length) {
            finalName = await getAvailableName(finalName)
            finalOrderNumber = await getAvailableOrderNumber(finalOrderNumber + 1)
          }
          continue
        }
        throw err
      }
    }
    return json(res, 409, { message: 'สร้างไม่สำเร็จ: มีชื่อ/ลำดับซ้ำหลายรายการ ลองอีกครั้ง' })
  } catch (err) {
    return handlePrismaError(res, err)
  }
}

// —————————————————————— UPLOAD COVER ONLY ——————————————————————
export const uploadCategoryCover = async (req, res) => {
  try {
    if (!req.file) return json(res, 400, { message: 'กรุณาเลือกรูปภาพ' })
    const result = await cloudinary.uploader.upload(req.file.path, { folder: 'category-covers' })
    await fs.unlink(req.file.path).catch(() => {})
    return json(res, 200, { message: 'อัปโหลดภาพปกสำเร็จ', image_url: result.secure_url })
  } catch (err) {
    return handlePrismaError(res, err)
  }
}

// —————————————————————— UPDATE ——————————————————————
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params
    const { name, order_number, image_url, cover_image: coverImageBody } = req.body
    let cover_image = req.body.cover_image || undefined

    const existing = await prisma.category.findUnique({ where: { id } })
    if (!existing) return json(res, 404, { message: 'ไม่พบหมวดหมู่' })

    // ตรวจสอบ/หา order_number ใหม่ถ้าชน
    let newOrderNumber = toInt(order_number)
    if (typeof newOrderNumber === 'number' && newOrderNumber !== existing.order_number) {
      const dup = await prisma.category.findFirst({
        where: { order_number: newOrderNumber, NOT: { id } },
      })
      if (dup) newOrderNumber = await getAvailableOrderNumber(newOrderNumber)
    }

    // อัปโหลดรูปใหม่ถ้ามีไฟล์ หรืออัปเดตจาก URL
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'category-covers' })
      cover_image = result.secure_url
      await fs.unlink(req.file.path).catch(() => {})
    } else if (image_url || coverImageBody) {
      cover_image = String(image_url || coverImageBody)
    }

    // ชื่อ: ถ้าเปลี่ยนชื่อ ให้หา candidate ที่ไม่ชน (เทียบ normalize)
    let finalNamePatch = undefined
    if (name && normalizeName(name) !== normalizeName(existing.name)) {
      finalNamePatch = await getAvailableName(name)
    }

    const slugPatch = finalNamePatch ? slugify(finalNamePatch) : undefined

const category = await prisma.category.update({
  where: { id },
  data: {
    ...(finalNamePatch ? { name: finalNamePatch } : {}),
    ...(slugPatch ? { slug: slugPatch } : {}),   // ✅
    ...(typeof newOrderNumber === 'number' ? { order_number: newOrderNumber } : {}),
    ...(cover_image !== undefined ? { cover_image } : {}),
  },
})

    return json(res, 200, { message: 'อัปเดตหมวดหมู่สำเร็จ', category })
  } catch (err) {
    return handlePrismaError(res, err)
  }
}

// —————————————————————— DELETE ——————————————————————
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params

    // ป้องกัน FK ก่อนลบ (ชัดเจนกว่าปล่อยให้ DB ดีด)
    const usingCount = await prisma.store.count({ where: { category_id: id } }).catch(() => 0)
    if (usingCount > 0) {
      return json(res, 409, {
        message: 'ลบไม่ได้: ยังมีร้านที่อยู่ในหมวดหมู่นี้',
        usingCount,
      })
    }

    await prisma.category.delete({ where: { id } })
    return json(res, 200, { message: 'ลบหมวดหมู่สำเร็จ' })
  } catch (err) {
    return handlePrismaError(res, err)
  }
}

// —————————————————————— READ (Public/Admin) ——————————————————————
export const getAllCategories = async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { order_number: 'asc' } })
    return json(res, 200, categories)
  } catch (err) {
    return handlePrismaError(res, err)
  }
}

export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params
    const category = await prisma.category.findUnique({ where: { id } })
    if (!category) return json(res, 404, { message: 'ไม่พบหมวดหมู่' })
    return json(res, 200, category)
  } catch (err) {
    return handlePrismaError(res, err)
  }
}

export const getAllCategoriesAdmin = async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { order_number: 'asc' } })
    return json(res, 200, { categories })
  } catch (err) {
    return handlePrismaError(res, err)
  }
}

export const getCategoryByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params
    const category = await prisma.category.findUnique({ where: { id } })
    if (!category) return json(res, 404, { message: 'ไม่พบหมวดหมู่' })
    return json(res, 200, category)
  } catch (err) {
    return handlePrismaError(res, err)
  }
}