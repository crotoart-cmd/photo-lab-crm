/**
 * Chạy: node scripts/seed.js (từ thư mục backend, sau khi có .env)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { ensureSampleCustomers } = require('../services/ensureSampleCustomers');

const connectForSeed = async () => {
  if (process.env.USE_MEMORY_DB === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ MongoDB (in-memory) cho seed');
    return mongod;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB:', process.env.MONGODB_URI);
  return null;
};

const seed = async () => {
  const mongod = await connectForSeed();

  const { OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME } = require('../config/users');
  let owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) {
    owner = new User({
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      role: 'owner',
    });
    await owner.save();
    console.log('✅ Chủ hệ thống:', OWNER_EMAIL);
  } else {
    console.log('ℹ️  Chủ hệ thống đã tồn tại');
  }

  const samples = [
    { itemName: 'Developer C-41', category: 'chemical', quantity: 8, unit: 'lít', minStock: 3 },
    { itemName: 'Kodak Gold 200', category: 'film', quantity: 24, unit: 'cuộn', minStock: 10 },
    { itemName: 'Ilford HP5', category: 'film', quantity: 6, unit: 'cuộn', minStock: 10 },
    { itemName: 'Fixer', category: 'chemical', quantity: 2, unit: 'lít', minStock: 5 },
  ];

  for (const item of samples) {
    const exists = await Inventory.findOne({ itemName: item.itemName });
    if (!exists) {
      await Inventory.create(item);
      console.log('✅ Inventory:', item.itemName);
    }
  }

  await ensureSampleCustomers();

  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  console.log('🎉 Seed completed (14 khách @ *.demo@labstart.test)');
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
