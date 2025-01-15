const db = require('../config/db');
const path = require('path');

// Контролер для отримання всіх продуктів
exports.getAllProducts = (req, res) => {
    const query = `
        SELECT products.*, GROUP_CONCAT(product_media.media_url) AS media_urls
        FROM products
        LEFT JOIN product_media ON products.id = product_media.product_id
        GROUP BY products.id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const serverUrl = `${req.protocol}://${req.get('host')}`;

        const modifiedResults = results.map((product) => {
            if (product.media_urls) {
                product.mediaUrls = product.media_urls.split(',').map(url => `${serverUrl}${url}`);
            }
            return product;
        });

        res.json(modifiedResults);
    });
};

// Контролер для додавання продукту
exports.addProduct = (req, res) => {
    const { name, description, price, category_id, stock, specification, material, weight } = req.body;

    const query = `
        INSERT INTO products (name, description, price, category_id, stock, specification, material, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [name, description, price, category_id, stock, specification || null, material || null, weight || null], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error adding product', error: err });
        }

        const productId = result.insertId;

        // Додаємо медіа-файли (зображення та відео)
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const mediaUrl = `/uploads/${file.filename}`;
                const mediaType = file.mimetype.startsWith('image') ? 'image' : 'video';

                const mediaQuery = 'INSERT INTO product_media (product_id, media_url, media_type) VALUES (?, ?, ?)';
                db.query(mediaQuery, [productId, mediaUrl, mediaType], (mediaErr) => {
                    if (mediaErr) {
                        console.error('Error adding media:', mediaErr);
                    }
                });
            });
        }

        res.status(201).json({ message: 'Product added successfully', productId });
    });
};

// Контролер для отримання продуктів певної категорії
exports.getProductsByCategory = (req, res) => {
    const { category_id } = req.params;
    const query = `
        SELECT products.*, GROUP_CONCAT(product_media.media_url) AS media_urls
        FROM products
        LEFT JOIN product_media ON products.id = product_media.product_id
        WHERE products.category_id = ?
        GROUP BY products.id
    `;

    db.query(query, [category_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const serverUrl = `${req.protocol}://${req.get('host')}`;

        const modifiedResults = results.map((product) => {
            if (product.media_urls) {
                product.mediaUrls = product.media_urls.split(',').map(url => `${serverUrl}${url}`);
            }
            return product;
        });

        res.json(modifiedResults);
    });
};

// Контролер для отримання продукту за id
exports.getProductById = (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT products.*, GROUP_CONCAT(product_media.media_url) AS media_urls
        FROM products
        LEFT JOIN product_media ON products.id = product_media.product_id
        WHERE products.id = ?
        GROUP BY products.id
    `;

    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Product not found' });

        const product = results[0];

        const serverUrl = `${req.protocol}://${req.get('host')}`;
        if (product.media_urls) {
            product.mediaUrls = product.media_urls.split(',').map(url => `${serverUrl}${url}`);
        }

        res.json(product);
    });
};
// Контролер для оновлення продукту
exports.updateProduct = (req, res) => {
    const { id } = req.params;
    const { name, description, price, category_id, stock, specification, material, weight } = req.body;

    const query = `
        UPDATE products
        SET name = ?, description = ?, price = ?, category_id = ?, stock = ?, specification = ?, material = ?, weight = ?
        WHERE id = ?
    `;

    db.query(query, [name, description, price, category_id, stock, specification || null, material || null, weight || null, id], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Error updating product', error: err });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Оновлюємо медіа-файли, якщо є нові
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                const mediaUrl = `/uploads/${file.filename}`;
                const mediaType = file.mimetype.startsWith('image') ? 'image' : 'video';

                const mediaQuery = 'INSERT INTO product_media (product_id, media_url, media_type) VALUES (?, ?, ?)';
                db.query(mediaQuery, [id, mediaUrl, mediaType], (mediaErr) => {
                    if (mediaErr) {
                        console.error('Error updating media:', mediaErr);
                    }
                });
            });
        }

        res.status(200).json({ message: 'Product updated successfully' });
    });
};

