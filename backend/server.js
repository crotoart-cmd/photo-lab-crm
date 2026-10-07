const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '12mb' }));
// Không parse multipart — để multer xử lý upload ảnh delivery
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/films', require('./routes/films'));
app.use('/api/repairs', require('./routes/repairs'));
app.use('/api/repair-public', require('./routes/repairPublic'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/retail', require('./routes/retail'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/email', require('./routes/email'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/delivery', require('./routes/deliveryPublic'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Hostinger / production: phục vụ React build cùng origin với /api
const webDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(path.join(webDist, 'index.html'))) {
  app.use(express.static(webDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const connectDatabase = async () => {
  const useMemory = process.env.USE_MEMORY_DB === 'true';

  if (useMemory) {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected (in-memory — dữ liệu mất khi tắt server)');
    return mongod;
  }

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nuocleo-crm';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const host = String(uri).replace(/\/\/.*@/, '//***@').split('?')[0];
  console.log('✅ MongoDB connected:', host);
  return null;
};

const PORT = process.env.PORT || 5000;

const afterDatabaseReady = async () => {
    const { ensureOwner } = require('./services/ensureOwner');
    const { ensureSampleCustomers } = require('./services/ensureSampleCustomers');
    const { ensureSampleRepairTickets } = require('./services/ensureSampleRepairTickets');
    const { ensureSampleRetailSales } = require('./services/ensureSampleRetailSales');
    const { OWNER_EMAIL } = require('./config/users');
    await ensureOwner();
    await ensureSampleCustomers();
    await ensureSampleRepairTickets();
    // Đơn bán demo (SALE-DEMO-*) chỉ nạp khi bật cờ — tránh thổi phồng
    // doanh thu/đơn trên DB thật (dashboard tính mọi RetailSale).
    if (process.env.SEED_DEMO_SALES === 'true') {
      await ensureSampleRetailSales();
    }
    console.log(`   Đăng nhập chủ: ${OWNER_EMAIL}`);

    if (process.env.AUTO_SEED === 'true') {
      const Inventory = require('./models/Inventory');
      const FilmStock = require('./models/FilmStock');
      const BatteryStock = require('./models/BatteryStock');
      const CameraStock = require('./models/CameraStock');

      const samples = [
        { itemName: 'Developer C-41', category: 'chemical', quantity: 8000, unit: 'ml', minStock: 3000 },
      ];
      for (const item of samples) {
        if (!(await Inventory.findOne({ itemName: item.itemName }))) {
          await Inventory.create(item);
        }
      }

      if (!(await FilmStock.findOne({ sku_code: 'FLM-KOD-CP200-35' }))) {
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 18);
        await FilmStock.create({
          sku_code: 'FLM-KOD-CP200-35',
          name: 'Kodak ColorPlus 200 35mm',
          brand: 'Kodak',
          iso: 200,
          size: '35mm',
          quantity: 12,
          expiry_date: exp,
          cost: 130000,
          price: 180000,
          floor_price: 130000,
        });
      }
      if (!(await BatteryStock.findOne({ sku_code: 'BAT-LR44-PK' }))) {
        await BatteryStock.create({
          sku_code: 'BAT-LR44-PK',
          name: 'Pin LR44 vỉ 4 viên',
          battery_type: 'LR44',
          quantity: 30,
          cost: 50000,
          price: 90000,
          floor_price: 50000,
        });
      }
      if (!(await CameraStock.findOne({ serial_number: 'SN129481' }))) {
        await CameraStock.create({
          camera_code: 'CAM-CANON-QL17-SN129481',
          model_name: 'Canon QL17 GIII',
          serial_number: 'SN129481',
          condition_note: 'Mới 95%, lens sạch, có bao da',
          cost: 3500000,
          price: 5000000,
          floor_price: 3500000,
          status: 'San_Hang',
        });
      }
    }
};

const startDatabase = () => {
  connectDatabase()
    .then(afterDatabaseReady)
    .catch((err) => {
      console.error('❌ MongoDB connection error:', err.message);
      console.error('   Gợi ý: Atlas → Network Access → Allow Access from Anywhere (0.0.0.0/0)');
      setTimeout(startDatabase, 15000);
    });
};

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}/api`);
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    console.log(`🌐 Web UI: ${webDist}`);
  }
  console.log('✅ Retail: /api/retail (film/pin/máy, smart-intake, smart-sale)');
  startDatabase();
});
