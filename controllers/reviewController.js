const db = require('../config/db');
const calculateAverageRating = require('../utils/calculateAverageRating');
exports.addReview = (req, res) => {
    const { review_text, star_rating, reviewer_name, reviewer_email } = req.body;
    const product_id = req.params.product_id;

    const query = `
        INSERT INTO reviews (product_id, review_text, star_rating, reviewer_name, reviewer_email) 
        VALUES (?, ?, ?, ?, ?)
    `;
    
    db.query(query, [product_id, review_text, star_rating, reviewer_name, reviewer_email || null], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Review added successfully' });
    });
};


exports.getReviewsByProductId = (req, res) => {
    const productId = parseInt(req.params.product_id, 10);

    if (isNaN(productId) || productId <= 0) {
        return res.status(400).json({ error: "Некоректний ID продукту" });
    }

    const query = `
        SELECT review_text, star_rating, reviewer_name, reviewer_email
        FROM reviews
        WHERE product_id = ?
    `;

    db.query(query, [productId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const averageRating = calculateAverageRating(results);

        res.json({ reviews: results, average_rating: averageRating });
    });
};
