import cron from "node-cron";
import { deactivateExpiredStores } from "./cronJobs/deactivateExpiredStores.js";

export const startCronJobs = () => {
  // รันทุกวันเที่ยงคืน
  cron.schedule("0 0 * * *", () => {
    console.log("🚀 Cron ตรวจสอบร้านที่หมดอายุ...");
    deactivateExpiredStores();
  });

  // 🔁 รันทันทีเพื่อทดสอบ (ลบออกภายหลัง)
  deactivateExpiredStores();
};