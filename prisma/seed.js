import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@example.com",
      password_hash: "hash123",
      role: "admin"
    }
  })

  const cat = await prisma.category.create({
    data: {
      name: "ร้านอาหาร",
      image_url: "https://cdn.example.com/cat.jpg"
    }
  })

  await prisma.Store.create({
    data: {
      name: "ข้าวมันไก่เจ๊แดง",
      category_id: cat.id,
      description: "เปิดมา 30 ปี",
      avg_review: 0,
      social_links: "https://facebook.com/example",
      image_url: "https://cdn.example.com/store.jpg"
    }
  })
}

main()
  .then(() => console.log("Seed done"))
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())