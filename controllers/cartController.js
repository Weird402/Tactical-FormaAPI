const db = require('../config/db'); // Підключаємо базу даних
const MEDIA_BASE_URL = process.env.URL;

const cartController = {
    // Отримати кошик з деталями продукту, кольором, розміром і кількістю
    getCart: (req, res) => {
        const cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];

        if (cart.length > 0) {
            const productIds = cart.map(item => item.product_id);
            const colors = cart.map(item => item.color);

            const query = `
                SELECT 
                    p.product_id, 
                    p.name, 
                    p.description, 
                    p.price, 
                    pm.media_url, 
                    pm.media_type, 
                    pc.color_id, 
                    pc.color 
                FROM products p
                LEFT JOIN product_media pm ON p.product_id = pm.product_id
                LEFT JOIN product_colors pc ON pc.color_id = pm.color_id
                WHERE p.product_id IN (?)
                ORDER BY pm.color_id IS NULL, pm.color_id
            `;

            db.query(query, [productIds], (err, results) => {
                if (err) {
                    res.status(500).json({ error: 'Failed to retrieve products: ' + err.message });
                } else {
                    const cartWithDetails = cart.map(cartItem => {
                        const productMedia = results.filter(
                            p => p.product_id === cartItem.product_id
                        );

                        const sortedMedia = productMedia.sort((a, b) => {
                            if (a.color_id === null && b.color_id !== null) return 1;
                            if (a.color_id !== null && b.color_id === null) return -1;
                            return 0;
                        });

                        const product = productMedia.find(p => p.color === cartItem.color) || sortedMedia[0];

                        if (product) {
                            return {
                                product_id: product.product_id,
                                name: product.name,
                                description: product.description,
                                price: product.price,
                                media: sortedMedia.map(media => ({
                                    media_url: `${MEDIA_BASE_URL}${media.media_url}`,
                                    media_type: media.media_type,
                                })),
                                color: product.color,
                                color_id: product.color_id,
                                size: cartItem.size,
                                quantity: cartItem.quantity
                            };
                        }
                        return null;
                    }).filter(item => item !== null);

                    res.json(cartWithDetails);
                }
            });
        } else {
            res.json({ cart: [] });
        }
    },
    // Додати товар до кошика з урахуванням кольору, розміру та кількості
    addToCart: (req, res) => {
        const { product_id, color, size, quantity } = req.body;

        const colorQuery = `SELECT color_id FROM product_colors WHERE color = ?`;
        db.query(colorQuery, [color], (err, colorResult) => {
            if (err || colorResult.length === 0) {
                return res.status(400).json({ error: 'Invalid color' });
            }

            const color_id = colorResult[0].color_id;
            const cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
            const existingItem = cart.find(item => item.product_id === product_id && item.color === color && item.size === size);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({ product_id, color, color_id, size, quantity });
            }

            res.cookie('cart', JSON.stringify(cart), { httpOnly: true, maxAge: 7 * 86400 * 1000 });
            res.status(201).json({ message: 'Product added to cart successfully', cart });
        });
    },

    // Оновити кількість товару у кошику
    updateCartItem: (req, res) => {
        const { product_id, color, size, quantity } = req.body;

        const cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        const item = cart.find(item => item.product_id === product_id && item.color === color && item.size === size);

        if (item) {
            item.quantity = quantity;
        }

        res.cookie('cart', JSON.stringify(cart), { httpOnly: true, maxAge: 7 * 86400 * 1000 });
        res.status(200).json({ message: 'Product quantity updated successfully', cart });
    },

    // Видалити товар з кошика
    removeFromCart: (req, res) => {
        const { product_id, color, size } = req.body;

        let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
        cart = cart.filter(item => !(item.product_id === product_id && item.color === color && item.size === size));

        res.cookie('cart', JSON.stringify(cart), { httpOnly: true, maxAge: 7 * 86400 * 1000 });
        res.status(200).json({ message: 'Product removed from cart', cart });
    },

    // Очистити весь кошик
    clearCart: (req, res) => {
        res.clearCookie('cart');
        res.status(200).json({ message: 'Cart cleared successfully' });
    }
};

module.exports = cartController;
