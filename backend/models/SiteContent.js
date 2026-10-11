const mongoose = require('mongoose');

const siteContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['blog', 'accessory'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    slug: { type: String, default: '', trim: true },
    kind: { type: String, default: '', trim: true },
    author: { type: String, default: '', trim: true },
    excerpt: { type: String, default: '', trim: true },
    body: { type: String, default: '', trim: true },
    image: { type: String, default: '' },
    images: { type: [String], default: [] },
    price: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, default: 0, min: 0 },
    receivedQty: { type: Number, default: 0, min: 0 },
    published: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteContent', siteContentSchema);
