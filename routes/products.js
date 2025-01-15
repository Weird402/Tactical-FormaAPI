const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');

// Конфігурація Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Куди зберігати файли
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Унікальне ім'я файлу
    },
    limits: { fileSize: 100 * 1024 * 1024 }
});
const upload = multer({ storage: storage });

// Middleware для додавання заголовків CORS
router.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Маршрути продуктів
router.get('/', productController.getAllProducts);
router.get('/search', productController.searchProducts);
router.get('/latest', productController.getLatestProducts);
router.get('/filtered', productController.getFilteredProducts);
router.get('/category/:category_id', productController.getProductsByCategory);
router.get('/similar/:product_id', productController.getSimilarProducts);
router.get('/:product_id', productController.getProductById);

// POST: Додавання продукту
router.post(
    '/',
    authenticateToken,
    isAdmin,
    (req, res, next) => {
        //console.log('CORS Middleware for POST /api/products'); // Лог для перевірки
        next();
    },
    productController.addProduct
);

// PUT: Оновлення продукту
router.put('/:product_id', authenticateToken, isAdmin, productController.updateProduct);

// DELETE: Видалення продукту
router.delete(
    '/deleteForCategory/:category_id',
    authenticateToken,
    isAdmin,
    productController.deleteProductsByCategory
);
router.delete('/:product_id', authenticateToken, isAdmin, productController.deleteProduct);

module.exports = router;
