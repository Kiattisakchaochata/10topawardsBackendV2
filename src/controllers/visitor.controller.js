import prisma from '../config/prisma.config.js'

// ✅ เพิ่มจำนวนผู้เข้าชมเว็บไซต์ (รวม)
export const incrementWebsiteVisitor = async (req, res, next) => {
  try {
    const counter = await prisma.websiteVisitorCounter.upsert({
      where: { id: 'singleton' },
      update: { total: { increment: 1 } },
      create: { id: 'singleton', total: 1 }
    })
    res.json({ total: counter.total })
  } catch (err) {
    next(err)
  }
}

// ✅ เพิ่มจำนวนผู้เข้าชมร้านค้า (แต่ละร้าน)
export const incrementStoreVisitor = async (req, res, next) => {
  try {
    const { id } = req.params
    const counter = await prisma.visitorCounter.upsert({
      where: { storeId: id },
      update: { total: { increment: 1 } },
      create: { storeId: id, total: 1 }
    })
    res.json({ total: counter.total })
  } catch (err) {
    next(err)
  }
}

// ✅ ดึงข้อมูลรวมของผู้เข้าชม (ใช้แสดงใน admin dashboard)
export const getVisitorStats = async (req, res, next) => {
  try {
    const global = await prisma.websiteVisitorCounter.findUnique({
      where: { id: 'singleton' }
    })

    const storeStats = await prisma.visitorCounter.findMany({
      include: {
        store: { select: { id: true, name: true } }
      }
    })

    res.json({
      totalVisitors: global?.total || 0,
      perStore: storeStats
    })
  } catch (err) {
    next(err)
  }
}