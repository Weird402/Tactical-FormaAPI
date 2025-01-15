const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/add/:product_id', reviewController.addReview);
router.get('/:product_id', reviewController.getReviewsByProductId);

module.exports = router;
