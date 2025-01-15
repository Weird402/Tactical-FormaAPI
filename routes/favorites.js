const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/authMiddleware');

router.get('/', optionalAuthenticateToken, favoriteController.getFavorites);
router.post('/add/:product_id', optionalAuthenticateToken, favoriteController.addToFavorites);
router.delete('/remove/:product_id', optionalAuthenticateToken, favoriteController.removeFromFavorites);

module.exports = router;
