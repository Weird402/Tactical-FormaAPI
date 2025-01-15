const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', categoryController.getAllCategories);
router.post('/', authenticateToken, isAdmin, categoryController.addCategory);
router.put('/:id', authenticateToken, isAdmin, categoryController.updateCategory);
router.delete('/:category_id', authenticateToken, isAdmin, categoryController.deleteCategory);

module.exports = router;