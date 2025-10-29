// src/services/stores.service.js
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const listStores = async () => {
  return prisma.store.findMany({
    orderBy: [{ order_number: "asc" }],
    include: {
      images: { orderBy: { order_number: "asc" } },
      category: true,
    },
  });
};

export const getStoreById = async (id) => {
  return prisma.store.findUnique({
    where: { id },
    include: {
      images: { orderBy: { order_number: "asc" } },
      category: true,
      reviews: true,
    },
  });
};

export const updateStore = async (id, data) => {
  return prisma.store.update({
    where: { id },
    data,
    include: {
      images: { orderBy: { order_number: "asc" } },
      category: true,
    },
  });
};

export const setActiveStatus = async (id, isActive) => {
  return prisma.store.update({
    where: { id },
    data: { is_active: isActive },
  });
};

export const deleteStore = async (id) => {
  return prisma.store.delete({ where: { id } });
};