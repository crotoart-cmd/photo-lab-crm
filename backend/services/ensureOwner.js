const User = require('../models/User');
const { OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME } = require('../config/users');

/**
 * Luôn đảm bảo có chủ hệ thống — chạy mỗi lần server khởi động (không phụ thuộc AUTO_SEED).
 */
async function ensureOwner() {
  await User.updateMany({ role: { $in: ['admin', 'manager'] } }, { $set: { role: 'owner' } });

  let owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) {
    owner = await User.create({
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      role: 'owner',
      status: 'active',
    });
    console.log(`✅ Đã tạo chủ hệ thống: ${OWNER_EMAIL}`);
    return owner;
  }

  owner.role = 'owner';
  owner.status = 'active';
  if (owner.name !== OWNER_NAME) owner.name = OWNER_NAME;

  if (process.env.RESET_OWNER_PASSWORD === 'true') {
    owner.password = OWNER_PASSWORD;
    console.log(`🔑 Đã reset mật khẩu chủ: ${OWNER_EMAIL}`);
  }

  await owner.save();
  return owner;
}

module.exports = { ensureOwner };
