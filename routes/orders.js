const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', authenticateToken, isAdmin, orderController.getAllOrders);
router.get('/:id', authenticateToken,isAdmin, orderController.getOrderById);
router.post('/guest', orderController.createOrderForGuest); // Додаємо маршрут для неавторизованих користувачів
router.put('/:id', authenticateToken, isAdmin, orderController.updateOrderForGuest);
router.delete('/:id', authenticateToken, isAdmin, orderController.deleteOrder);
router.get('/guest/:id',authenticateToken,isAdmin, orderController.getGuestOrderById); // Додаємо маршрут для неавторизованих користувачів
router.get('/products/:order_id',authenticateToken, isAdmin, orderController.getOrderProductsById);
router.get('/details/:order_id',authenticateToken, isAdmin, orderController.getOrderDetailsById);


module.exports = router;
