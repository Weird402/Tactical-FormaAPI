const db = require('../config/db'); // Підключення до бази даних

// Отримання всіх кольорів
exports.getColors = (req, res) => {
    db.query('SELECT * FROM product_colors', (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        res.json({ colors: results });
    });
};

// Отримання кольору за `color_id`
exports.getColorById = (req, res) => {
    const { color_id } = req.params;
    db.query('SELECT * FROM product_colors WHERE color_id = ?', [color_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Color not found' });
        }
        res.json({ color: results[0] });
    });
};

// Додавання нового кольору
exports.addColor = (req, res) => {
    const { product_id, color } = req.body;
    if (!product_id || !color) {
        return res.status(400).json({ error: 'Product ID and color are required' });
    }

    const query = 'INSERT INTO product_colors (product_id, color) VALUES (?, ?)';
    db.query(query, [product_id, color], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        res.status(201).json({ message: 'Color added successfully', colorId: result.insertId });
    });
};

// Оновлення кольору
exports.updateColor = (req, res) => {
    const { color_id } = req.params;
    const { color } = req.body;

    if (!color) {
        return res.status(400).json({ error: 'Color is required' });
    }

    const query = 'UPDATE product_colors SET color = ? WHERE color_id = ?';
    db.query(query, [color, color_id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        res.json({ message: 'Color updated successfully' });
    });
};

// Видалення кольору
exports.deleteColor = (req, res) => {
    const { color_id } = req.params;
    const query = 'DELETE FROM product_colors WHERE color_id = ?';

    db.query(query, [color_id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        res.json({ message: 'Color deleted successfully' });
    });
};

exports.getAllSizes = (req, res) => {
    const query = 'SELECT DISTINCT size FROM product_inventory ORDER BY size ASC';

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        const sizes = results.map(row => row.size); // Отримання списку розмірів
        res.json({ sizes });
    });
};

