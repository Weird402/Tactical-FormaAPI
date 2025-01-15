const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const calculateAverageRating = require('../utils/calculateAverageRating');
const MEDIA_BASE_URL=process.env.URL;

// Налаштування для multer (збереження файлів в 'uploads/' папці)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
const calculateAverageRatingQuery = `
    SELECT product_id, AVG(star_rating) AS average_rating
    FROM reviews
    GROUP BY product_id
`;
function getColorIdOrCreate(colorName) {
    return new Promise((resolve, reject) => {
        const selectColorQuery = `SELECT color_id FROM product_colors WHERE color = ?`;

        db.query(selectColorQuery, [colorName], (err, results) => {
            if (err) return reject(err);

            // Якщо колір існує, повертаємо його color_id
            if (results.length > 0) {
                return resolve(results[0].color_id);
            }

            // Якщо колір не знайдено, додаємо його в таблицю і повертаємо новий color_id
            const insertColorQuery = `INSERT INTO product_colors (color) VALUES (?)`;
            db.query(insertColorQuery, [colorName], (err, result) => {
                if (err) return reject(err);
                return resolve(result.insertId);  // Повертаємо новий color_id
            });
        });
    });
}
function addProductToMap(product, map) {
    if (!map.has(product.product_id)) {
        const createdAt = new Date(product.created_at);
        const isNew = (new Date() - createdAt) / (1000 * 60 * 60 * 24) <= 3;

        map.set(product.product_id, {
            ...product,
            isNew,
            media: [],
            inventory: []
        });
    }
}
function fetchAdditionalData(products, res) {
    const productIds = products.map(product => product.product_id);
    if (productIds.length === 0) {
        return res.json({ products: [] });
    }

    const mediaQuery = `
        SELECT 
            pm.product_id, 
            pm.media_url, 
            pm.media_type, 
            pc.color
        FROM product_media pm
        LEFT JOIN product_colors pc ON pm.color_id = pc.color_id
        WHERE pm.product_id IN (?)
    `;
    
    const inventoryQuery = `
        SELECT 
            pi.product_id, 
            pc.color, 
            pi.size, 
            pi.stock
        FROM product_inventory pi
        JOIN product_colors pc ON pi.color_id = pc.color_id
        WHERE pi.product_id IN (?)
    `;

    Promise.all([
        db.promise().query(mediaQuery, [productIds]),
        db.promise().query(inventoryQuery, [productIds])
    ])
    .then(([mediaResults, inventoryResults]) => {
        mediaResults[0].forEach(media => {
            const product = products.find(p => p.product_id === media.product_id);
            if (product) {
                product.media.push({
                    color: media.color,
                    media_url: `${MEDIA_BASE_URL}${media.media_url}`,
                    media_type: media.media_type
                });
            }
        });

        inventoryResults[0].forEach(inventory => {
            const product = products.find(p => p.product_id === inventory.product_id);
            if (product) {
                let colorEntry = product.inventory.find(i => i.color === inventory.color);
                if (!colorEntry) {
                    colorEntry = { color: inventory.color, sizes: [] };
                    product.inventory.push(colorEntry);
                }
                colorEntry.sizes.push({ size: inventory.size, stock: inventory.stock });
            }
        });

        res.json({ products });
    })
    .catch(error => res.status(500).json({ error: error.message }));
}
async function getColorIdOrCreate(colorName) {
    const query = `SELECT color_id FROM product_colors WHERE color = ?`;
    const [rows] = await db.promise().query(query, [colorName]);

    if (rows.length > 0) {
        return rows[0].color_id;
    } else {
        const insertQuery = `INSERT INTO product_colors (color) VALUES (?)`;
        const [result] = await db.promise().query(insertQuery, [colorName]);
        return result.insertId;
    }
}
async function deleteMediaFiles(productId) {
    try {
        const selectMediaQuery = 'SELECT media_url FROM product_media WHERE product_id = ?';
        const [mediaResults] = await db.promise().query(selectMediaQuery, [productId]);

        mediaResults.forEach((media) => {
            const filePath = path.join(__dirname, '..', media.media_url);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Failed to delete file: ${filePath}`, err);
            });
        });

        const deleteMediaQuery = 'DELETE FROM product_media WHERE product_id = ?';
        await db.promise().query(deleteMediaQuery, [productId]);
    } catch (error) {
        console.error(`Error deleting media files for product ${productId}:`, error);
        throw error;
    }
}
// Отримати всі продукти
exports.getAllProducts = (req, res) => {
    const query = `
        SELECT p.*, pm.media_url, pm.media_type 
        FROM products p
        LEFT JOIN product_media pm ON p.product_id = pm.product_id
    `;

    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const products = {};
        
        results.forEach(product => {
            const productId = product.product_id;

            if (!products[productId]) {
                products[productId] = {
                    product_id: product.product_id,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    category_id: product.category_id,
                    created_at: product.created_at,
                    average_rating: 0,
                    media: [],
                    inventory: []
                };
            }

            if (product.media_url) {
                products[productId].media.push({
                    media_url: `${MEDIA_BASE_URL}${product.media_url}`,
                    media_type: product.media_type
                });
            }
        });

        // Запит для отримання середнього рейтингу
        db.query(calculateAverageRatingQuery, (ratingErr, ratingResults) => {
            if (ratingErr) return res.status(500).json({ error: ratingErr.message });

            ratingResults.forEach(rating => {
                if (products[rating.product_id]) {
                    products[rating.product_id].average_rating = parseFloat(rating.average_rating).toFixed(2);
                }
            });

            const inventoryQuery = `
                SELECT pi.product_id, pc.color, pi.size, pi.stock
                FROM product_inventory pi
                JOIN product_colors pc ON pi.color_id = pc.color_id
            `;

            db.query(inventoryQuery, (err, inventoryResults) => {
                if (err) return res.status(500).json({ error: err.message });

                inventoryResults.forEach(item => {
                    const product = products[item.product_id];
                    if (product) {
                        const colorEntry = product.inventory.find(i => i.color === item.color);
                        if (colorEntry) {
                            colorEntry.sizes.push({ size: item.size, stock: item.stock });
                        } else {
                            product.inventory.push({
                                color: item.color,
                                sizes: [{ size: item.size, stock: item.stock }]
                            });
                        }
                    }
                });

                res.json(Object.values(products));
            });
        });
    });
};
// Отримати продукт за ID
exports.getProductById = (req, res) => {
    const productId = parseInt(req.params.product_id, 10);

    if (isNaN(productId) || productId <= 0) {
        return res.status(400).json({ error: "Некоректний ID продукту" });
    }

    const query = `
        SELECT p.*, pm.media_url, pm.media_type, pm.color_id, pc.color AS color_name
        FROM products p
        LEFT JOIN product_media pm ON p.product_id = pm.product_id
        LEFT JOIN product_colors pc ON pm.color_id = pc.color_id
        WHERE p.product_id = ?
    `;

    db.query(query, [productId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Продукт не знайдено' });

        const product = {
            product_id: results[0].product_id,
            name: results[0].name,
            description: results[0].description,
            price: results[0].price,
            category_id: results[0].category_id,
            created_at: results[0].created_at,
            average_rating: 0,
            media: {},
            inventory: [],
            reviews: []
        };

        results.forEach(result => {
            if (result.media_url) {
                const colorKey = `${result.color_id}_${result.color_name}`;
                if (!product.media[colorKey]) product.media[colorKey] = [];
                
                product.media[colorKey].push({
                    media_url: `${MEDIA_BASE_URL}${result.media_url}`,
                    media_type: result.media_type
                });
            }
        });

        const inventoryQuery = `
            SELECT pc.color, pi.size, pi.stock
            FROM product_inventory pi
            JOIN product_colors pc ON pi.color_id = pc.color_id
            WHERE pi.product_id = ?
        `;

        db.query(inventoryQuery, [productId], (err, inventoryResults) => {
            if (err) return res.status(500).json({ error: err.message });

            inventoryResults.forEach(item => {
                const existingColor = product.inventory.find(i => i.color === item.color);
                if (existingColor) {
                    existingColor.sizes.push({ size: item.size, stock: item.stock });
                } else {
                    product.inventory.push({
                        color: item.color,
                        sizes: [{ size: item.size, stock: item.stock }]
                    });
                }
            });

            // Додаємо запит для отримання рецензій на продукт
            const reviewsQuery = `
                SELECT review_text, star_rating, reviewer_name, reviewer_email
                FROM reviews
                WHERE product_id = ?
            `;

            db.query(reviewsQuery, [productId], (err, reviewsResults) => {
                if (err) return res.status(500).json({ error: err.message });

                product.reviews = reviewsResults.map(review => ({
                    review_text: review.review_text,
                    star_rating: review.star_rating,
                    reviewer_name: review.reviewer_name,
                    reviewer_email: review.reviewer_email || null
                }));

                product.average_rating = calculateAverageRating(reviewsResults);

                res.json(product);
            });
        });
    });
};

// Додати продукт
exports.addProduct = async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            upload.fields([{ name: 'image' }, { name: 'video' }])(req, res, (err) => {
                if (err) reject(new Error('Помилка завантаження файлів'));
                resolve();
            });
        });

        const { name, description, price, category_id, inventory } = req.body;

        const productQuery = `
            INSERT INTO products (name, description, price, category_id) 
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await db.promise().query(productQuery, [name, description, price, category_id]);
        const productId = result.insertId;

        const parsedInventory = JSON.parse(inventory);
        const mediaData = [];
        const inventoryData = [];

        for (const item of parsedInventory) {
            const colorId = await getColorIdOrCreate(item.color);
            item.sizes.forEach(sizeObj => {
                inventoryData.push([productId, colorId, sizeObj.size, sizeObj.stock]);
            });
        }

        if (req.files['image'] || req.files['video']) {
            const allFiles = [...(req.files['image'] || []), ...(req.files['video'] || [])];
            for (const [index, file] of allFiles.entries()) {
                const colorName = Array.isArray(req.body.image_color)
                    ? req.body.image_color[index]
                    : req.body.image_color;
                const colorId = await getColorIdOrCreate(colorName);

                const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';

                mediaData.push([productId, `/uploads/${file.filename}`, fileType, colorId]);
            }
        }

        if (mediaData.length > 0) {
            const mediaQuery = `
                INSERT INTO product_media (product_id, media_url, media_type, color_id)
                VALUES ?
            `;
            await db.promise().query(mediaQuery, [mediaData]);
        }

        if (inventoryData.length > 0) {
            const inventoryQuery = `
                INSERT INTO product_inventory (product_id, color_id, size, stock)
                VALUES ?
            `;
            await db.promise().query(inventoryQuery, [inventoryData]);
        }

        res.status(201).json({ message: 'Продукт успішно додано з медіа та інвентарем' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Оновити продукт
exports.updateProduct = async (req, res) => {
    await new Promise((resolve, reject) => {
        upload.fields([{ name: 'image' }, { name: 'video' }])(req, res, (err) => {
            if (err) reject(new Error('Помилка завантаження файлів'));
            resolve();
        });
    });

    try {
        const { name, description, price, category_id, inventory, media_to_delete } = req.body;

        // Оновлення основної інформації про продукт
        const productQuery = `
            UPDATE products 
            SET name = ?, description = ?, price = ?, category_id = ? 
            WHERE product_id = ?
        `;
        await db.promise().query(productQuery, [name, description, price, category_id, req.params.product_id]);

        // Видалення старих медіафайлів
        if (media_to_delete) {
            const mediaToDelete = JSON.parse(media_to_delete);
            for (const mediaUrl of mediaToDelete) {
                const filename = mediaUrl.split('/').pop();
                const filePath = path.join(__dirname, '..', 'uploads', filename);

                try {
                    await fs.unlink(filePath); // Видалення файлу з системи
                } catch (err) {
                    console.error(`Не вдалося видалити файл: ${filePath}`, err);
                }

                const deleteMediaQuery = `DELETE FROM product_media WHERE media_url = ?`;
                await db.promise().query(deleteMediaQuery, [`/uploads/${filename}`]);
            }
        }

        // Оновлення інвентаря
        if (inventory) {
            const parsedInventory = JSON.parse(inventory);

            const deleteInventoryQuery = `DELETE FROM product_inventory WHERE product_id = ?`;
            await db.promise().query(deleteInventoryQuery, [req.params.product_id]);

            const inventoryData = [];
            for (const item of parsedInventory) {
                const colorId = await getColorIdOrCreate(item.color);
                item.sizes.forEach(sizeObj => {
                    inventoryData.push([req.params.product_id, colorId, sizeObj.size, sizeObj.stock]);
                });
            }

            if (inventoryData.length > 0) {
                const insertInventoryQuery = `
                    INSERT INTO product_inventory (product_id, color_id, size, stock)
                    VALUES ?
                `;
                await db.promise().query(insertInventoryQuery, [inventoryData]);
            }
        }

        // Додавання нових медіафайлів
        const mediaFiles = [];
        if (req.files['image'] || req.files['video']) {
            const allFiles = [...(req.files['image'] || []), ...(req.files['video'] || [])];
            for (const [index, file] of allFiles.entries()) {
                const colorName = Array.isArray(req.body.image_color)
                    ? req.body.image_color[index]
                    : req.body.image_color;
                const colorId = colorName ? await getColorIdOrCreate(colorName) : null;

                const fileType = file.mimetype.startsWith('image/') ? 'image' : 'video';

                mediaFiles.push([req.params.product_id, `/uploads/${file.filename}`, fileType, colorId]);
            }
        }

        if (mediaFiles.length > 0) {
            const insertMediaQuery = `
                INSERT INTO product_media (product_id, media_url, media_type, color_id)
                VALUES ?
            `;
            await db.promise().query(insertMediaQuery, [mediaFiles]);
        }

        res.status(200).json({ message: 'Продукт оновлено з медіа та інвентарем' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// Видалити продукт
exports.deleteProduct = async (req, res) => {
    const productId = req.params.product_id;

    try {
        const [productResults] = await db.promise().query('SELECT * FROM products WHERE product_id = ?', [productId]);
        if (productResults.length === 0) return res.status(404).json({ message: 'Product not found' });

        const productName = productResults[0].name;
        if (productName === 'Deleted product') {
            return res.status(400).json({ message: 'Cannot delete the "Deleted product"' });
        }

        const updateOrdersQuery = `
            UPDATE order_items SET product_id = 
            (SELECT product_id FROM products WHERE name = 'Deleted product' LIMIT 1) WHERE product_id = ?
        `;
        await db.promise().query(updateOrdersQuery, [productId]);

        await deleteMediaFiles(productId);

        const deleteFromCartQuery = 'DELETE FROM cart_items WHERE product_id = ?';
        await db.promise().query(deleteFromCartQuery, [productId]);

        const deleteInventoryQuery = 'DELETE FROM product_inventory WHERE product_id = ?';
        await db.promise().query(deleteInventoryQuery, [productId]);

        const deleteReviewsQuery = 'DELETE FROM reviews WHERE product_id = ?';
        await db.promise().query(deleteReviewsQuery, [productId]);

        const deleteProductQuery = 'DELETE FROM products WHERE product_id = ?';
        await db.promise().query(deleteProductQuery, [productId]);

        res.json({ message: 'Product and all associated data deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
// Отримати всі продукти певної категорії
exports.getProductsByCategory = (req, res) => {
    const categoryId = req.params.category_id;
    const query = 'SELECT * FROM products WHERE category_id = ?';
    db.query(query, [categoryId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};
// Отримати всі продукти певної категорії з пагінацією
exports.getProductsByCategory = (req, res) => {
    const categoryId = req.params.category_id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const offset = (page - 1) * limit;

    const countQuery = 'SELECT COUNT(*) AS total FROM products WHERE category_id = ?';
    db.query(countQuery, [categoryId], (countErr, countResult) => {
        if (countErr) return res.status(500).json({ error: countErr.message });

        const totalProducts = countResult[0].total;
        const totalPages = Math.ceil(totalProducts / limit);

        const query = `
            SELECT 
                p.product_id, 
                p.name, 
                p.description, 
                p.price, 
                p.category_id,
                p.created_at
            FROM products p
            WHERE p.category_id = ?
            LIMIT ? OFFSET ?
        `;

        db.query(query, [categoryId, limit, offset], (err, productResults) => {
            if (err) return res.status(500).json({ error: err.message });

            const products = productResults.map(product => {
                const createdAt = new Date(product.created_at);
                const currentDate = new Date();
                const timeDiff = Math.abs(currentDate - createdAt);
                const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                return {
                    ...product,
                    isNew: dayDiff <= 7,
                    average_rating: 0, 
                    media: [],
                    inventory: []
                };
            });

            const productIds = productResults.map(product => product.product_id);
            if (productIds.length === 0) {
                return res.json({
                    page,
                    totalPages,
                    totalProducts,
                    products: []
                });
            }

            const mediaQuery = `
                SELECT 
                    pm.product_id, 
                    pm.media_url, 
                    pm.media_type, 
                    pc.color_id, 
                    pc.color
                FROM product_media pm
                LEFT JOIN product_colors pc ON pm.color_id = pc.color_id
                WHERE pm.product_id IN (?)
            `;
            db.query(mediaQuery, [productIds], (mediaErr, mediaResults) => {
                if (mediaErr) return res.status(500).json({ error: mediaErr.message });

                mediaResults.forEach(media => {
                    const product = products.find(p => p.product_id === media.product_id);
                    if (product) {
                        product.media.push({
                            color: media.color,
                            media_url: `${MEDIA_BASE_URL}${media.media_url}`,
                            media_type: media.media_type
                        });
                    }
                });

                const inventoryQuery = `
                    SELECT 
                        pi.product_id, 
                        pc.color, 
                        pi.size, 
                        pi.stock
                    FROM product_inventory pi
                    JOIN product_colors pc ON pi.color_id = pc.color_id
                    WHERE pi.product_id IN (?)
                `;
                db.query(inventoryQuery, [productIds], (inventoryErr, inventoryResults) => {
                    if (inventoryErr) return res.status(500).json({ error: inventoryErr.message });

                    inventoryResults.forEach(inventory => {
                        const product = products.find(p => p.product_id === inventory.product_id);
                        if (product) {
                            const colorEntry = product.inventory.find(i => i.color === inventory.color);
                            if (colorEntry) {
                                colorEntry.sizes.push({ size: inventory.size, stock: inventory.stock });
                            } else {
                                product.inventory.push({
                                    color: inventory.color,
                                    sizes: [{ size: inventory.size, stock: inventory.stock }]
                                });
                            }
                        }
                    });

                    db.query(calculateAverageRatingQuery, (ratingErr, ratingResults) => {
                        if (ratingErr) return res.status(500).json({ error: ratingErr.message });

                        ratingResults.forEach(rating => {
                            const product = products.find(p => p.product_id === rating.product_id);
                            if (product) {
                                product.average_rating = parseFloat(rating.average_rating).toFixed(2);
                            }
                        });

                        res.json({
                            page,
                            totalPages,
                            totalProducts,
                            products
                        });
                    });
                });
            });
        });
    });
};
// Пошук продуктів за назвою або описом
exports.searchProducts = (req, res) => {
    const searchTerm = req.query.q;
    if (!searchTerm) return res.status(400).json({ error: 'Search query is required' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const likeSearchTerm = `%${searchTerm}%`;

    const countQuery = 'SELECT COUNT(*) AS total FROM products WHERE name LIKE ? OR description LIKE ?';
    db.query(countQuery, [likeSearchTerm, likeSearchTerm], (countErr, countResult) => {
        if (countErr) return res.status(500).json({ error: countErr.message });

        const totalProducts = countResult[0].total;
        const totalPages = Math.ceil(totalProducts / limit);
        const productQuery = `
            SELECT * FROM products 
            WHERE name LIKE ? OR description LIKE ? 
            LIMIT ? OFFSET ?
        `;
        
        db.query(productQuery, [likeSearchTerm, likeSearchTerm, limit, offset], (err, products) => {
            if (err) return res.status(500).json({ error: err.message });

            const productIds = products.map(product => product.product_id);
            if (productIds.length === 0) {
                return res.json({ page, totalPages, totalProducts, products: [] });
            }

            const mediaQuery = `
                SELECT pm.product_id, pm.media_url, pm.media_type, pc.color_id, pc.color
                FROM product_media pm
                LEFT JOIN product_colors pc ON pm.color_id = pc.color_id
                WHERE pm.product_id IN (?)
            `;
            
            db.query(mediaQuery, [productIds], (mediaErr, mediaResults) => {
                if (mediaErr) return res.status(500).json({ error: mediaErr.message });

                products.forEach(product => {
                    product.media = mediaResults
                        .filter(media => media.product_id === product.product_id)
                        .map(media => ({
                            media_url: `${MEDIA_BASE_URL}${media.media_url}`,
                            media_type: media.media_type,
                            color: media.color
                        }));
                });

                const inventoryQuery = `
                    SELECT pi.product_id, pc.color, pi.size, pi.stock
                    FROM product_inventory pi
                    JOIN product_colors pc ON pi.color_id = pc.color_id
                    WHERE pi.product_id IN (?)
                `;
                
                db.query(inventoryQuery, [productIds], (inventoryErr, inventoryResults) => {
                    if (inventoryErr) return res.status(500).json({ error: inventoryErr.message });

                    products.forEach(product => {
                        product.inventory = [];
                        inventoryResults
                            .filter(inventory => inventory.product_id === product.product_id)
                            .forEach(inventory => {
                                let colorEntry = product.inventory.find(i => i.color === inventory.color);
                                if (!colorEntry) {
                                    colorEntry = { color: inventory.color, sizes: [] };
                                    product.inventory.push(colorEntry);
                                }
                                colorEntry.sizes.push({ size: inventory.size, stock: inventory.stock });
                            });
                    });

                    res.json({
                        page,
                        totalPages,
                        totalProducts,
                        products
                    });
                });
            });
        });
    });
};
// Видалити всі продукти певної категорії
exports.deleteProductsByCategory = (req, res) => {
    const categoryId = req.params.category_id;

    const getProductsQuery = 'SELECT product_id FROM products WHERE category_id = ?';
    db.query(getProductsQuery, [categoryId], (err, productResults) => {
        if (err) return res.status(500).json({ error: err.message });

        if (productResults.length === 0) {
            return res.status(404).json({ message: 'No products found in this category' });
        }

        // Delete entries from product_inventory that reference products in the specified category
        const deleteInventoryQuery = `
            DELETE FROM product_inventory WHERE product_id IN 
            (SELECT product_id FROM products WHERE category_id = ?)
        `;
        db.query(deleteInventoryQuery, [categoryId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Update order items to reference a 'Deleted product' before deleting the products
            const updateOrdersQuery = `
                UPDATE order_items SET product_id = 
                (SELECT product_id FROM products WHERE name = 'Deleted product' LIMIT 1) 
                WHERE product_id IN (SELECT product_id FROM products WHERE category_id = ?)
            `;
            db.query(updateOrdersQuery, [categoryId], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Delete cart items related to the products in the specified category
                const deleteFromCartQuery = `
                    DELETE FROM cart_items WHERE product_id IN 
                    (SELECT product_id FROM products WHERE category_id = ?)
                `;
                db.query(deleteFromCartQuery, [categoryId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Finally, delete the products from the specified category
                    const deleteProductsQuery = `
                        DELETE FROM products WHERE category_id = ?
                    `;
                    db.query(deleteProductsQuery, [categoryId], (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ message: 'All products from this category deleted successfully' });
                    });
                });
            });
        });
    });
};
exports.getLatestProducts = (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;

    const query = `
        SELECT 
            p.product_id, 
            p.name, 
            p.description, 
            p.price, 
            p.category_id, 
            p.created_at, 
            GROUP_CONCAT(DISTINCT CONCAT(pm.media_url, '|', pm.media_type, '|', IFNULL(pc.color, 'NULL')) ORDER BY ISNULL(pc.color), pm.media_id) AS media_data
        FROM products p
        LEFT JOIN product_media pm ON p.product_id = pm.product_id
        LEFT JOIN product_colors pc ON pm.color_id = pc.color_id
        GROUP BY p.product_id, p.name, p.description, p.price, p.category_id, p.created_at
        ORDER BY p.created_at DESC
        LIMIT ?
    `;

    db.query(query, [limit], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });

        const products = {};

        results.forEach(product => {
            const productId = product.product_id;

            if (!products[productId]) {
                products[productId] = {
                    product_id: product.product_id,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    category_id: product.category_id,
                    created_at: product.created_at,
                    media: [],
                    inventory: []
                };
            }

            // Обробка медіа
            if (product.media_data) {
                const mediaEntries = product.media_data.split(',');
                mediaEntries.forEach(entry => {
                    const [media_url, media_type, color] = entry.split('|');
                    products[productId].media.push({
                        media_url: `${MEDIA_BASE_URL}${media_url}`,
                        media_type,
                        color: color === 'NULL' ? null : color
                    });
                });
            }
        });

        const productIds = Object.keys(products);

        const inventoryQuery = `
            SELECT pi.product_id, pc.color, pi.size, pi.stock
            FROM product_inventory pi
            JOIN product_colors pc ON pi.color_id = pc.color_id
            WHERE pi.product_id IN (?)
        `;
        db.query(inventoryQuery, [productIds], (inventoryErr, inventoryResults) => {
            if (inventoryErr) return res.status(500).json({ error: inventoryErr.message });

            inventoryResults.forEach(item => {
                const product = products[item.product_id];
                if (product) {
                    const colorEntry = product.inventory.find(i => i.color === item.color);
                    if (colorEntry) {
                        colorEntry.sizes.push({ size: item.size, stock: item.stock });
                    } else {
                        product.inventory.push({
                            color: item.color,
                            sizes: [{ size: item.size, stock: item.stock }]
                        });
                    }
                }
            });

            // Сортуємо медіа так, щоб медіафайли з кольором `NULL` були в кінці
            Object.values(products).forEach(product => {
                product.media.sort((a, b) => {
                    if (a.color === null && b.color !== null) return 1;
                    if (a.color !== null && b.color === null) return -1;
                    return 0;
                });
            });

            res.json(Object.values(products));
        });
    });
};


exports.getFilteredProducts = (req, res) => {
    const { category, min_price, max_price, color, size, sort_by, order, page = 1, limit = 10 } = req.query;

    let baseQuery = `
        SELECT p.product_id, p.name, p.description, p.price, p.category_id, p.created_at, 
               AVG(r.star_rating) AS average_rating
        FROM products p
        LEFT JOIN reviews r ON p.product_id = r.product_id
        LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
        LEFT JOIN product_colors pc ON pi.color_id = pc.color_id
        WHERE 1=1
    `;

    let countQuery = `
        SELECT COUNT(DISTINCT p.product_id) AS totalProducts
        FROM products p
        LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
        LEFT JOIN product_colors pc ON pi.color_id = pc.color_id
        WHERE 1=1
    `;

    const queryParams = [];
    const countParams = [];

    if (category) {
        baseQuery += ' AND p.category_id = ?';
        countQuery += ' AND p.category_id = ?';
        queryParams.push(category);
        countParams.push(category);
    }

    if (min_price) {
        baseQuery += ' AND p.price >= ?';
        countQuery += ' AND p.price >= ?';
        queryParams.push(min_price);
        countParams.push(min_price);
    }

    if (max_price) {
        baseQuery += ' AND p.price <= ?';
        countQuery += ' AND p.price <= ?';
        queryParams.push(max_price);
        countParams.push(max_price);
    }

    if (color) {
        const colors = color.split(',');
        baseQuery += ` AND pc.color IN (${colors.map(() => '?').join(',')})`;
        countQuery += ` AND pc.color IN (${colors.map(() => '?').join(',')})`;
        queryParams.push(...colors);
        countParams.push(...colors);
    }

    if (size) {
        const sizes = size.split(',');
        baseQuery += ` AND pi.size IN (${sizes.map(() => '?').join(',')})`;
        countQuery += ` AND pi.size IN (${sizes.map(() => '?').join(',')})`;
        queryParams.push(...sizes);
        countParams.push(...sizes);
    }

    baseQuery += ` GROUP BY p.product_id`;

    const allowedSortFields = ['price', 'average_rating', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'price';
    const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

    baseQuery += ` ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    db.query(countQuery, countParams, (countErr, countResults) => {
        if (countErr) return res.status(500).json({ error: countErr.message });

        const totalProducts = countResults[0].totalProducts;
        const totalPages = Math.ceil(totalProducts / limit);

        db.query(baseQuery, queryParams, (err, productResults) => {
            if (err) return res.status(500).json({ error: err.message });

            const products = productResults.map(product => {
                const createdAt = new Date(product.created_at);
                const currentDate = new Date();
                const timeDiff = Math.abs(currentDate - createdAt);
                const dayDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                return {
                    ...product,
                    isNew: dayDiff <= 3,
                    average_rating: product.average_rating ? parseFloat(product.average_rating).toFixed(2) : "0.00",
                    media: [],
                    inventory: []
                };
            });

            const productIds = productResults.map(product => product.product_id);
            if (productIds.length === 0) {
                return res.json({ totalProducts, totalPages, currentPage: page, products: [] });
            }

            const mediaQuery = `
                SELECT 
                    pm.product_id, 
                    pm.media_url, 
                    pm.media_type, 
                    pc.color_id, 
                    pc.color
                FROM product_media pm
                LEFT JOIN product_colors pc ON pm.color_id = pc.color_id
                WHERE pm.product_id IN (?)
            `;
            db.query(mediaQuery, [productIds], (mediaErr, mediaResults) => {
                if (mediaErr) return res.status(500).json({ error: mediaErr.message });

                mediaResults.forEach(media => {
                    const product = products.find(p => p.product_id === media.product_id);
                    if (product) {
                        product.media.push({
                            color: media.color,
                            media_url: `${MEDIA_BASE_URL}${media.media_url}`,
                            media_type: media.media_type
                        });
                    }
                });

                const inventoryQuery = `
                    SELECT 
                        pi.product_id, 
                        pc.color, 
                        pi.size, 
                        pi.stock
                    FROM product_inventory pi
                    JOIN product_colors pc ON pi.color_id = pc.color_id
                    WHERE pi.product_id IN (?)
                `;
                db.query(inventoryQuery, [productIds], (inventoryErr, inventoryResults) => {
                    if (inventoryErr) return res.status(500).json({ error: inventoryErr.message });

                    inventoryResults.forEach(inventory => {
                        const product = products.find(p => p.product_id === inventory.product_id);
                        if (product) {
                            const colorEntry = product.inventory.find(i => i.color === inventory.color);
                            if (colorEntry) {
                                colorEntry.sizes.push({ size: inventory.size, stock: inventory.stock });
                            } else {
                                product.inventory.push({
                                    color: inventory.color,
                                    sizes: [{ size: inventory.size, stock: inventory.stock }]
                                });
                            }
                        }
                    });

                    res.json({
                        page: parseInt(page),
                        totalPages,
                        totalProducts,
                        products
                    });
                });
            });
        });
    });
};
// подобні товари 
exports.getSimilarProducts = (req, res) => {
    const productId = parseInt(req.params.product_id, 10);

    if (isNaN(productId) || productId <= 0) {
        return res.status(400).json({ error: "Некоректний ID продукту" });
    }

    const productQuery = `
        SELECT category_id, name 
        FROM products 
        WHERE product_id = ?
    `;

    db.query(productQuery, [productId], (productErr, productResults) => {
        if (productErr) return res.status(500).json({ error: productErr.message });
        if (productResults.length === 0) return res.status(404).json({ message: 'Продукт не знайдено' });

        const { category_id: categoryId, name } = productResults[0];
        const productsMap = new Map();

        const categoryMatchQuery = `
            SELECT p.product_id, p.name, p.description, p.price, p.category_id, p.created_at,
                   MATCH(p.name, p.description) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance
            FROM products p
            WHERE p.category_id = ? AND p.product_id != ?
            ORDER BY relevance DESC
            LIMIT 8
        `;

        db.query(categoryMatchQuery, [name, categoryId, productId], (categoryErr, categoryProducts) => {
            if (categoryErr) return res.status(500).json({ error: categoryErr.message });

            categoryProducts.forEach(product => addProductToMap(product, productsMap));

            if (productsMap.size < 8) {
                const crossCategoryMatchQuery = `
                    SELECT p.product_id, p.name, p.description, p.price, p.category_id, p.created_at,
                           MATCH(p.name, p.description) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance
                    FROM products p
                    WHERE p.product_id != ? AND p.category_id != ?
                    ORDER BY relevance DESC
                    LIMIT ?
                `;

                const remainingSlots = 8 - productsMap.size;
                db.query(crossCategoryMatchQuery, [name, productId, categoryId, remainingSlots], (crossErr, crossCategoryProducts) => {
                    if (crossErr) return res.status(500).json({ error: crossErr.message });

                    crossCategoryProducts.forEach(product => addProductToMap(product, productsMap));

                    const productsArray = Array.from(productsMap.values());

                    // Отримання медіафайлів
                    const mediaQuery = `
                        SELECT pm.media_url, pm.media_type, pm.product_id, pc.color
                        FROM product_media pm
                        LEFT JOIN product_colors pc ON pm.color_id = pc.color_id
                        WHERE pm.product_id IN (?)
                        ORDER BY ISNULL(pc.color), pm.media_id
                    `;

                    const productIds = productsArray.map(p => p.product_id);

                    db.query(mediaQuery, [productIds], (mediaErr, mediaResults) => {
                        if (mediaErr) return res.status(500).json({ error: mediaErr.message });

                        mediaResults.forEach(media => {
                            const product = productsArray.find(p => p.product_id === media.product_id);
                            if (product) {
                                product.media = product.media || [];
                                product.media.push({
                                    media_url: `${MEDIA_BASE_URL}${media.media_url}`,
                                    media_type: media.media_type,
                                    color: media.color || null
                                });
                            }
                        });

                        res.json({ products: productsArray });
                    });
                });
            } else {
                res.json({ products: Array.from(productsMap.values()) });
            }
        });
    });
};



