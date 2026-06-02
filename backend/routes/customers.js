const express = require('express');
const Customer = require('../models/Customer');
const { verifyToken } = require('./auth');

const router = express.Router();

// Create customer
router.post('/', verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, city, postalCode, notes } = req.body;

    const customer = new Customer({
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      postalCode,
      notes,
    });

    await customer.save();
    res.status(201).json({ message: 'Customer created', customer });
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
});

// Get all customers
router.get('/', verifyToken, async (req, res) => {
  try {
    const customers = await Customer.find();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
});

// Get customer by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
});

// Update customer
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    res.json({ message: 'Customer updated', customer });
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
});

// Delete customer
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
});

module.exports = router;
