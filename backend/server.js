const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const {
  applySecurityHeaders,
  corsOrigin,
  sanitizeRedirectPath,
  assertSecurityEnv,
  allowDemoSeed,
  trustedProxySetting,
  sanitizeApiErrors,
} = require('./middleware/security');
const { IMAGE_TYPES, uploadResponseHeaders } = require('./lib/uploads');
const { rateLimit } = require('./middleware/rateLimit');

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', trustedProxySetting());

assertSecurityEnv();

app.use(applySecurityHeaders);
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '4mb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use('/api', sanitizeApiErrors);
app.use('/api', rateLimit({ max: 300, windowMs: 5 * 60 * 1000, bucket: 'api', message: 'Quá nhiều yêu cầu. Thử lại sau.' }));

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
app.use('/api/public', require('./routes/publicIntake'));
app.use('/api/site-content', require('./routes/siteContent'));

const uploadsRoot = path.join(__dirname, 'uploads');
app.use(
  '/uploads/site',
  (req, res, next) => {
    if (!uploadResponseHeaders(res, req.path, IMAGE_TYPES)) return res.status(404).end();
    return next();
  },
  express.static(path.join(uploadsRoot, 'site'), { index: false, dotfiles: 'deny' })
);

const { isPublicWebHost, getAdminSiteUrl } = require('./config/hosts');
const { stayOnPublicHost, mountPublicSeo } = require('./lib/publicSeo');
const { renderPublicSeo } = require('./lib/publicSeoMetadata');
mountPublicSeo(app);
app.use((req, res, next) => {
  if (!isPublicWebHost(req.hostname)) return next();
  if (stayOnPublicHost(req.path)) return next();
  const dest = sanitizeRedirectPath(req.originalUrl || req.path);
  return res.redirect(302, `${getAdminSiteUrl()}${dest}`);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Hostinger / production: phục vụ React build cùng origin với /api
const webDistCandidates = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '..', 'frontend', 'dist'),
];
const webDist = webDistCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || webDistCandidates[0];
if (fs.existsSync(path.join(webDist, 'index.html'))) {
  const webHtml = fs.readFileSync(path.join(webDist, 'index.html'), 'utf8');
  app.use(express.static(webDist, { index: false, dotfiles: 'deny' }));
  app.get(/^\/google[A-Za-z0-9_-]+\.html$/i, (_req, res) => res.status(404).type('text/plain').send('Not found'));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderPublicSeo(webHtml, { hostname: req.hostname, pathname: req.path, language: req.query.lang }));
  });
}

app.use((err, req, res, next) => {
  console.error(err?.message || err);
  if (res.headersSent) return next(err);
  const requested = Number(err.status);
  const status = Number.isInteger(requested) && requested >= 400 && requested < 500 ? requested : 500;
  res.status(status).json({ message: status === 413 ? 'Dữ liệu vượt giới hạn cho phép' : 'Không xử lý được yêu cầu' });
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

  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hdtlabx-crm';
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
    if (allowDemoSeed()) {
      await ensureSampleCustomers();
      await ensureSampleRepairTickets();
    }
    // Đơn bán demo (SALE-DEMO-*) chỉ nạp khi bật cờ — tránh thổi phồng
    // doanh thu/đơn trên DB thật (dashboard tính mọi RetailSale).
    if (process.env.SEED_DEMO_SALES === 'true') {
      await ensureSampleRetailSales();
    }
    const { ensureShopWebSeed } = require('./services/ensureShopWebSeed');
    await ensureShopWebSeed();
    const { migratePlaintextConfirmTokens } = require('./services/customerRepairService');
    await migratePlaintextConfirmTokens();
    if (allowDemoSeed()) {
      console.log(`   Đăng nhập chủ: ${OWNER_EMAIL}`);
    }

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

const server = app.listen(PORT, process.env.BIND_HOST || '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}/api`);
  if (fs.existsSync(path.join(webDist, 'index.html'))) {
    console.log(`🌐 Web UI: ${webDist}`);
  }
  console.log('✅ Retail: /api/retail (film/pin/máy, smart-intake, smart-sale)');
  startDatabase();
});
server.timeout = 30000;
server.headersTimeout = 35000;
server.requestTimeout = 30000;
