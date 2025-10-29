export const authorizeRole = (requiredRole) => {
  return (req, res, next) => {
    console.log('✅ ROLE CHECK');
    if (!req.user || req.user.role.toLowerCase() !== requiredRole.toLowerCase()) {
      return res.status(403).json({ message: 'ไม่มีสิทธิ์ใช้งาน' })
    }
    next()
  }
}