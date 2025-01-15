const express = require('express');
const router = express.Router();
const colorController = require('../controllers/colorController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');

router.get('/', colorController.getColors);
router.get('/sizes', colorController.getAllSizes);
router.get('/:color_id', colorController.getColorById);
//router.get('/sizes', colorController.getAllSizes);
router.post('/',authenticateToken, isAdmin, colorController.addColor);
router.put('/:color_id',authenticateToken, isAdmin, colorController.updateColor);
router.delete('/:color_id',authenticateToken, isAdmin, colorController.deleteColor);

module.exports = router;
