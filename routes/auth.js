const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middlewares/authMiddlewares');



// Маршрути для реєстрації, логіну та лог-ауту
router.post('/register', authController.registerAdmin);
router.post('/login', authController.loginAdmin);
router.post('/logout', authController.logoutAdmin);

// Маршрут для перевірки ролі користувача
router.get('/isAdmin', authenticateToken, authController.isAdmin);

module.exports = router;
