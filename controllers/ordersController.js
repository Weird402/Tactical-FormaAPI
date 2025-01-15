const db = require('../config/db');

// Додаємо замовлення для гостя
exports.createOrderForGuest = (req, res) => {
    const { guestInfo, cartItems } = req.body;

    // Перевірка наявності необхідних полів
    if (!guestInfo || !cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: 'Guest info and cart items are required' });
    }

    const { name, email, phone_number } = guestInfo;

    // Створюємо гостя в таблиці "guests"
    const guestQuery = `INSERT INTO guests (name, email, phone_number, created_at) VALUES (?, ?, ?, NOW())`;
    db.query(guestQuery, [name, email, phone_number], (err, guestResult) => {
        if (err) {
            console.error("Error inserting guest:", err);
            return res.status(500).json({ error: 'Failed to create guest' });
        }

        const guestId = guestResult.insertId;

        // Створюємо замовлення в таблиці "orders"
        const orderQuery = `INSERT INTO orders (guest_id, created_at) VALUES (?, NOW())`;
        db.query(orderQuery, [guestId], (err, orderResult) => {
            if (err) {
                console.error("Error inserting order:", err);
                return res.status(500).json({ error: 'Failed to create order' });
            }

            const orderId = orderResult.insertId;

            // Додаємо товари до таблиці "order_items"
            const orderItemsQuery = `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?`;
            const orderItemsData = cartItems.map(item => [orderId, item.productId, item.quantity, item.price]);

            db.query(orderItemsQuery, [orderItemsData], (err) => {
                if (err) {
                    console.error("Error inserting order items:", err);
                    return res.status(500).json({ error: 'Failed to add order items' });
                }

                res.json({ message: 'Order created successfully', orderId });
            });
        });
    });
};

// Отримуємо всі замовлення гостя
exports.getGuestOrders = (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
    }

    const query = `
        SELECT orders.id AS orderId, orders.total_amount, orders.created_at, order_items.product_id, order_items.quantity, order_items.price
        FROM orders
        JOIN order_items ON orders.id = order_items.order_id
        WHERE orders.guest_id = (SELECT id FROM guests WHERE session_id = ?)
        ORDER BY orders.created_at DESC
    `;

    db.query(query, [sessionId], (err, results) => {
        if (err) {
            console.error('Error fetching guest orders:', err);
            return res.status(500).json({ error: 'Database error while fetching orders' });
        }

        res.json(results);
    });
};
