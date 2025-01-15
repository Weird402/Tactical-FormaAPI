const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/authMiddleware');

// Використовуємо `optionalAuthenticateToken`, щоб дозволити роботу з кошиком через cookies
router.get('/', optionalAuthenticateToken, cartController.getCart);
router.post('/add', optionalAuthenticateToken, cartController.addToCart);
router.put('/update/:item_id', optionalAuthenticateToken, cartController.updateCartItem);
router.delete('/remove/:item_id', optionalAuthenticateToken, cartController.removeFromCart);
router.delete('/clear', optionalAuthenticateToken, cartController.clearCart);

module.exports = router;
