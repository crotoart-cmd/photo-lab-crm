#!/usr/bin/env node
/** Đồng bộ master catalog backend → frontend bundle (offline / iOS) */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const camera = require(path.join(root, 'backend/data/cameraFilmCatalog'));
const film = require(path.join(root, 'backend/data/filmStockCatalog'));
const outDir = path.join(root, 'frontend/src/data');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const publicCamera = camera.map(
  ({ catalogKey, brand, model, modelShort, cameraType, notes, serialRange, serialValidation }) => ({
    catalogKey,
    brand,
    model,
    modelShort,
    cameraType,
    notes,
    serialValidation,
  }),
);

const publicFilm = film.map(
  ({
    catalogKey,
    brand,
    name,
    formats,
    iso,
    filmType,
    exposures,
    colorCharacter,
    skuTemplate,
  }) => ({
    catalogKey,
    brand,
    name,
    formats,
    iso,
    filmType,
    exposures,
    colorCharacter,
    skuTemplate,
  }),
);

fs.writeFileSync(
  path.join(outDir, 'masterCameraCatalog.json'),
  JSON.stringify(publicCamera, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(outDir, 'masterFilmCatalog.json'),
  JSON.stringify(publicFilm, null, 2) + '\n',
);

console.log(
  `✅ master catalog → frontend/src/data (${publicCamera.length} máy, ${publicFilm.length} film)`,
);
