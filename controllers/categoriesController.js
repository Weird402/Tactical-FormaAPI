    const db = require('../config/db');

    exports.addCategory = (req, res) => {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        const query = 'INSERT INTO categories (name) VALUES (?)';
        db.query(query, [name], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Error adding category', error: err });
            }

            res.status(201).json({ message: 'Category added successfully', categoryId: result.insertId });
        });
    };

    exports.getAllCategories = (req, res) => {
        const query = 'SELECT * FROM categories';
        db.query(query, (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
    };