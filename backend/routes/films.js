const express = require('express');
const Film = require('../models/Film');
const Customer = require('../models/Customer');
const { verifyToken } = require('./auth');
const { sendConfirmationEmail, sendCompletionEmail } = require('../services/emailService');
const crypto = require('crypto');

const router = express.Router();

const generateFilmCode = () => `FM-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
const generateConfirmationCode = () => crypto.randomBytes(6).toString('hex').toUpperCase();

// Create film record (receive film)
router.post('/receive', verifyToken, async (req, res) => {
  try {
    const { customerId, quantity, filmType } = req.body;

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const filmCode = generateFilmCode();
    const confirmationCode = generateConfirmationCode();

    const film = new Film({
      customerId,
      filmCode,
      confirmationCode,
      quantity,
      filmType,
      status: 'received',
      createdBy: req.userId,
    });

    await film.save();

    await sendConfirmationEmail(customer.email, customer.firstName, filmCode, confirmationCode);

    res.status(201).json({ message: 'Film received successfully', film });
  } catch (error) {
    res.status(500).json({ message: 'Error receiving film', error: error.message });
  }
});

// Update film status (start processing)
router.put('/:id/start-processing', verifyToken, async (req, res) => {
  try {
    const film = await Film.findByIdAndUpdate(
      req.params.id,
      { status: 'processing', processingStartedAt: Date.now() },
      { new: true }
    );
    res.json({ message: 'Processing started', film });
  } catch (error) {
    res.status(500).json({ message: 'Error starting processing', error: error.message });
  }
});

// Complete processing
router.put('/:id/complete', verifyToken, async (req, res) => {
  try {
    const { processingNotes } = req.body;
    const film = await Film.findById(req.params.id);

    if (!film) {
      return res.status(404).json({ message: 'Film not found' });
    }

    film.status = 'completed';
    film.completedAt = Date.now();
    film.processingNotes = processingNotes;
    await film.save();

    const customer = await Customer.findById(film.customerId);
    await sendCompletionEmail(customer.email, customer.firstName, film.filmCode, film.confirmationCode);

    res.json({ message: 'Processing completed', film });
  } catch (error) {
    res.status(500).json({ message: 'Error completing processing', error: error.message });
  }
});

// Deliver film (manager one-click)
router.put('/:id/deliver', verifyToken, async (req, res) => {
  try {
    const { confirmationCode } = req.body;
    const film = await Film.findById(req.params.id);

    if (!film) {
      return res.status(404).json({ message: 'Film not found' });
    }

    if (film.confirmationCode !== confirmationCode) {
      return res.status(400).json({ message: 'Invalid confirmation code' });
    }

    film.status = 'delivered';
    film.deliveredAt = Date.now();
    film.emailDeliveryConfirmedAt = Date.now();
    await film.save();

    res.json({ message: 'Film delivered successfully', film });
  } catch (error) {
    res.status(500).json({ message: 'Error delivering film', error: error.message });
  }
});

// Get all films
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};

    if (status) filter.status = status;
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }

    const films = await Film.find(filter).populate('customerId').sort({ createdAt: -1 });
    res.json(films);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching films', error: error.message });
  }
});

// Get film by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const film = await Film.findById(req.params.id).populate('customerId');
    if (!film) {
      return res.status(404).json({ message: 'Film not found' });
    }
    res.json(film);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching film', error: error.message });
  }
});

module.exports = router;
