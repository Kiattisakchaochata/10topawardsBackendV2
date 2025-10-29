export const createError = (status, message = 'เกิดข้อผิดพลาด', errors = []) => {
  const err = new Error(message)
  err.status = status
  err.errors = errors
  return err
}