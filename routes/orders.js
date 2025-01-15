const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/ordersController');

router.post('/guest/orders', ordersController.createOrderForGuest);
router.get('/guest/orders', ordersController.getGuestOrders);

module.exports = router;
