"use strict";

var express = require('express');

var router = express.Router();

var orderController = require('../controllers/orderController');

var _require = require('../middlewares/authMiddleware'),
    authenticateToken = _require.authenticateToken,
    isAdmin = _require.isAdmin;

router.get('/', authenticateToken, isAdmin, orderController.getAllOrders);
router.get('/:id', authenticateToken, orderController.getOrderById);
router.post('/', authenticateToken, orderController.createOrder);
router.post('/guest', orderController.createOrderForGuest); // Додаємо маршрут для неавторизованих користувачів

router.put('/:id', authenticateToken, isAdmin, orderController.updateOrder);
router["delete"]('/:id', authenticateToken, isAdmin, orderController.deleteOrder);
router.get('/guest/:id', authenticateToken, isAdmin, orderController.getGuestOrderById); // Додаємо маршрут для неавторизованих користувачів

router.get('/products/:order_id', authenticateToken, isAdmin, orderController.getOrderProductsById);
module.exports = router;