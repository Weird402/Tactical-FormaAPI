const express = require('express');
const router = express.Router();
const productController = require('../controllers/productsController');

const { authenticateToken, isAdmin } = require('../middlewares/authMiddlewares');
const multer = require('multer');
const path = require('path');

// Налаштування Multer для збереження декількох файлів
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Куди зберігати зображення/відео
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // Додаємо унікальне ім'я файлу
    }
});

const upload = multer({ storage: storage }); // Ініціалізація multer

// Маршрути
router.get('/', productController.getAllProducts);
router.get('/category/:category_id', productController.getProductsByCategory);
router.get('/:id', productController.getProductById);
router.post('/', upload.array('media', 10), productController.addProduct); // Дозволяємо завантажувати до 10 файлів
router.put('/:id',authenticateToken, isAdmin, upload.array('media', 10), productController.updateProduct);

module.exports = router;
