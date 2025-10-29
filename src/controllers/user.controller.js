// controllers/user.controller.js
import prisma from '../config/prisma.config.js'

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true }
    })
    res.json(users)
  } catch (err) {
    next(err)
  }
}