const db = require('../config/db');
const nodemailer = require('nodemailer');
const MEDIA_BASE_URL=process.env.URL;
const cron = require('node-cron');

function sendFollowUpEmail(order) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'tactical.forma@gmail.com', // Ваша пошта
            pass: process.env.EMAIL_PASSWORD // Пароль від пошти (згенерований app password)
        }
    });

    const emailHTML = `
        <h2>Дякуємо за ваше замовлення!</h2>
        <p>Ми були б вдячні, якби ви оцінили товар, який ви придбали:</p>
        <h3>${order.product_name}</h3>
        <p>Ваша оцінка допоможе іншим клієнтам зробити правильний вибір.</p>
        <p>
            <a href="https://tactical-forma.com/product/${order.product_id}#review" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Оцінити товар</a>
        </p>
    `;

    const mailOptions = {
        from: 'tactical.forma@gmail.com',
        to: order.guest_email,
        subject: `Оцініть ваш товар - ${order.product_name}`,
        html: emailHTML
    };

    transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
      //      console.error(`Помилка під час відправлення листа для замовлення ${order.order_id}:`, err);
        } else {
    //        console.log(`Follow-up email для замовлення ${order.order_id} успішно відправлено:`, info.response);
        }
    });
}
// Cron Job: запуск щохвилини для тестування
cron.schedule('0 13 * * *', () => {
  //  console.log('Перевірка замовлень для відправки follow-up email...');

    // SQL-запит для отримання замовлень, створених 3 хвилини тому
    const query = `
        SELECT 
            o.order_id, 
            g.name AS guest_name, 
            g.email AS guest_email, 
            p.name AS product_name, 
            p.product_id  -- Включаємо product_id у вибірку
        FROM orders o
        JOIN guests g ON o.guest_id = g.guest_id
        JOIN order_items oi ON o.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.product_id
        WHERE DATE(o.created_at) = DATE(DATE_SUB(NOW(), INTERVAL 7 DAY))

    `;

    db.query(query, (err, results) => {
        if (err) {
            //console.error('Помилка під час вибірки замовлень:', err);
            return;
        }

        if (results.length > 0) {
            results.forEach(order => {
                sendFollowUpEmail(order);
            });
        } else {
           // console.log('Немає замовлень для відправки follow-up email.');
        }
    });
});
// Отримати всі замовлення (тільки для незареєстрованих користувачів)
exports.getAllOrders = (req, res) => {
    const query = 'SELECT * FROM orders WHERE guest_id IS NOT NULL';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};
// Отримати замовлення за ID (для незареєстрованих користувачів)
exports.getOrderById = (req, res) => {
    const query = 'SELECT * FROM orders WHERE order_id = ? AND guest_id IS NOT NULL';
    db.query(query, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
};
exports.createOrderForGuest = async (req, res) => {
    const { guest_name, guest_email, guest_phone, address, city, delivery_method, products, total_price, payment_method } = req.body;

    try {
        // Додавання гостя
        const guestQuery = `
            INSERT INTO guests (name, email, phone, address, city, payment_method, delivery_method)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [guestResult] = await db.promise().query(guestQuery, [guest_name, guest_email, guest_phone, address, city, payment_method, delivery_method]);
        const guestId = guestResult.insertId;

        // Додавання замовлення
        const orderQuery = `
            INSERT INTO orders (guest_id, total, status)
            VALUES (?, ?, ?)
        `;
        const orderStatus = 'Нове';
        const [orderResult] = await db.promise().query(orderQuery, [guestId, total_price, orderStatus]);
        const orderId = orderResult.insertId;


        // Отримання color_id для продуктів
        const colorPromises = products.map(product => {
            return new Promise((resolve, reject) => {
                const colorQuery = `
                    SELECT pc.color_id, p.name 
                    FROM product_colors pc
                    JOIN products p ON p.product_id = ?
                    WHERE pc.color = ?
                `;
                db.query(colorQuery, [product.product_id, product.color], (colorErr, colorResult) => {
                    if (colorErr || colorResult.length === 0) {
                        return reject(new Error(`Color "${product.color}" not found for product_id: ${product.product_id}`));
                    }
                    resolve({
                        ...product,
                        color_id: colorResult[0].color_id,
                        name: colorResult[0].name // Додаємо назву продукту
                    });
                });
            });
        });
        

        const updatedProducts = await Promise.all(colorPromises);


        // Додавання продуктів у замовлення
        const orderItemsQuery = `
            INSERT INTO order_items (order_id, product_id, quantity, color_id, size, price)
            VALUES ?
        `;
        const orderItems = updatedProducts.map(product => [
            orderId,
            product.product_id,
            product.quantity,
            product.color_id,
            product.size.toString().trim(), // Конвертація до тексту і видалення зайвих пробілів
            product.price
        ]);
        await db.promise().query(orderItemsQuery, [orderItems]);

        // Оновлення складу
        const stockPromises = updatedProducts.map(product => {
            return new Promise((resolve, reject) => {
                const stockQuery = `
                    UPDATE product_inventory
                    SET stock = stock - ?
                    WHERE product_id = ? AND color_id = ? AND size = ?
                `;
                
                db.query(stockQuery, [product.quantity, product.product_id, product.color_id, product.size.toString().trim()], (stockErr, result) => {
                    if (stockErr) return reject(stockErr);
                    if (result.affectedRows === 0) {
                        return reject(new Error(`Insufficient stock for product_id: ${product.product_id}, size: ${product.size}`));
                    }
                    resolve();
                });
            });
        });

        await Promise.all(stockPromises);

            sendOrderEmails({
            guest_name,
            guest_email,
            guest_phone,
            orderId,
            products: updatedProducts,
            total_price,
            address,
            city,
            payment_method,
            delivery_method
        });
        

        res.status(201).json({ message: 'Order created successfully for guest', orderId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
exports.updateOrderForGuest = async (req, res) => {
    const { order_id, address, city, delivery_method, products, total_price, payment_method, status, guest_name, guest_email, guest_phone } = req.body;

    try {
        // Повернення старих продуктів на склад
        const restoreStockQuery = `
            SELECT product_id, color_id, size, quantity 
            FROM order_items 
            WHERE order_id = ?
        `;
        const [oldProducts] = await db.promise().query(restoreStockQuery, [order_id]);

        const restorePromises = oldProducts.map(product => {
            return new Promise((resolve, reject) => {
                const restoreQuery = `
                    UPDATE product_inventory
                    SET stock = stock + ?
                    WHERE product_id = ? AND color_id = ? AND size = ?
                `;
                db.query(restoreQuery, [product.quantity, product.product_id, product.color_id, product.size.toString()], (restoreStockErr) => {
                    if (restoreStockErr) return reject(restoreStockErr);
                    resolve();
                });
            });
        });
        await Promise.all(restorePromises);

        // Оновлення інформації про гостя
        const updateGuestQuery = `
            UPDATE guests g
            JOIN orders o ON g.guest_id = o.guest_id
            SET g.address = ?, 
                g.city = ?, 
                g.delivery_method = ?, 
                g.payment_method = ?, 
                g.name = ?, 
                g.email = ?, 
                g.phone = ?
            WHERE o.order_id = ?
        `;
        await db.promise().query(updateGuestQuery, [address, city, delivery_method, payment_method, guest_name, guest_email, guest_phone, order_id]);

        // Видалення старих продуктів із замовлення
        const deleteItemsQuery = `DELETE FROM order_items WHERE order_id = ?`;
        await db.promise().query(deleteItemsQuery, [order_id]);

        // Отримання color_id для продуктів
        const colorPromises = products.map(product => {
            return new Promise((resolve, reject) => {
                const colorQuery = `SELECT color_id FROM product_colors WHERE color = ?`;
                db.query(colorQuery, [product.color], (colorErr, colorResult) => {
                    if (colorErr || colorResult.length === 0) {
                        return reject(new Error(`Color "${product.color}" not found for product_id: ${product.product_id}`));
                    }
                    resolve({
                        ...product,
                        color_id: colorResult[0].color_id
                    });
                });
            });
        });

        const updatedProducts = await Promise.all(colorPromises);

        // Додавання нових продуктів
        const orderItemsQuery = `
            INSERT INTO order_items (order_id, product_id, quantity, color_id, size, price)
            VALUES ?
        `;
        const orderItems = updatedProducts.map(product => [
            order_id,
            product.product_id,
            product.quantity,
            product.color_id,
            product.size.toString(),
            product.price
        ]);
        await db.promise().query(orderItemsQuery, [orderItems]);


        // Оновлення складу
        const stockPromises = updatedProducts.map(product => {
            return new Promise((resolve, reject) => {
                const stockQuery = `
                    UPDATE product_inventory
                    SET stock = stock - ?
                    WHERE product_id = ? AND color_id = ? AND size = ?
                `;
                db.query(stockQuery, [product.quantity, product.product_id, product.color_id, product.size.toString()], (stockErr, result) => {
                    if (stockErr) return reject(stockErr);
                    if (result.affectedRows === 0) {
                        return reject(new Error(`Insufficient stock for product_id: ${product.product_id}, size: ${product.size}`));
                    }
                    resolve();
                });
            });
        });
        await Promise.all(stockPromises);


        // Оновлення загальної інформації про замовлення
        const updateOrderQuery = `
            UPDATE orders
            SET total = ?, status = ?
            WHERE order_id = ?
        `;
        await db.promise().query(updateOrderQuery, [total_price, status || 'Оновлене', order_id]);


        res.status(200).json({ message: 'Order updated successfully', order_id });
    } catch (err) {

        res.status(500).json({ error: err.message });
    }
};

// Видалити замовлення
exports.deleteOrder = (req, res) => {
    const query = 'DELETE FROM orders WHERE order_id = ? AND guest_id IS NOT NULL';
    db.query(query, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Order deleted successfully' });
    });
};
exports.getGuestOrderById = (req, res) => {
    const query = 'SELECT * FROM guests WHERE guest_id = ?';
    db.query(query, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result);
    });
};
// Отримати товари у замовленні з деталями кольору, розміру та медіа
exports.getOrderProductsById = (req, res) => {
    const order_id = req.params.order_id;

    db.query(`
        SELECT 
            p.product_id AS product_id, 
            p.name, 
            p.description, 
            p.price, 
            pm.media_url AS image_url, 
            oi.quantity, 
            oi.color_id,
            pc.color AS color, 
            oi.size        
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        LEFT JOIN product_media pm ON p.product_id = pm.product_id  
        LEFT JOIN product_colors pc ON oi.color_id = pc.color_id    
        WHERE oi.order_id = ?`, 
        [order_id],
        (err, orderItems) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to retrieve order: ' + err.message });
            }
            res.json(orderItems);
        }
    );
};
// Отримати товари у замовленні без медіа
exports.getOrderDetailsById = (req, res) => {
    const orderId = req.params.order_id;

    // Запит для отримання деталей гостя, включаючи delivery_method
    const guestQuery = `
        SELECT g.guest_id, g.name, g.email, g.phone, g.address, g.city, g.payment_method, g.delivery_method
        FROM guests g
        JOIN orders o ON g.guest_id = o.guest_id
        WHERE o.order_id = ?
    `;

    // Запит для отримання основних деталей замовлення
    const orderQuery = `
        SELECT o.order_id, o.total, o.status, o.created_at
        FROM orders o
        WHERE o.order_id = ?
    `;

    db.query(guestQuery, [orderId], (guestErr, guestResult) => {
        if (guestErr) {
            return res.status(500).json({ error: 'Failed to retrieve guest details: ' + guestErr.message });
        }

        if (guestResult.length === 0) {
            return res.status(404).json({ error: 'Order not found or guest details missing' });
        }

        db.query(orderQuery, [orderId], (orderErr, orderItems) => {
            if (orderErr) {
                return res.status(500).json({ error: 'Failed to retrieve order details: ' + orderErr.message });
            }

            if (orderItems.length === 0) {
                return res.json({ guest: guestResult[0], order: null });
            }

            const productDetailsQuery = `
                SELECT 
                    oi.order_id,
                    p.product_id, 
                    p.name, 
                    p.description, 
                    p.price, 
                    oi.quantity, 
                    oi.color_id,
                    pc.color AS color, 
                    oi.size        
                FROM order_items oi
                JOIN products p ON oi.product_id = p.product_id
                LEFT JOIN product_colors pc ON oi.color_id = pc.color_id    
                WHERE oi.order_id = ?
            `;

            db.query(productDetailsQuery, [orderId], (productErr, productDetails) => {
                if (productErr) {
                    return res.status(500).json({ error: 'Failed to retrieve product details: ' + productErr.message });
                }

                // Об'єднання деталей замовлення та продуктів
                const orderWithProducts = { 
                    ...orderItems[0], 
                    products: productDetails, 
                    guest: guestResult[0] // Додаємо гостя, включаючи delivery_method
                };

                res.json(orderWithProducts);
            });
        });
    });
};
function sendOrderEmails({ guest_name, guest_email, guest_phone, orderId, products, total_price, address, city, payment_method, delivery_method }) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'tactical.forma@gmail.com',
            pass: process.env.EMAIL_PASSWORD  
        }
    });

    const generateOrderHTML = () => {
        let productRows = '';
        products.forEach(product => {
            const price = parseFloat(product.price) || 0;
            const totalPrice = (price * product.quantity).toFixed(2);
            productRows += `
                <tr>
                    <td>${product.name}</td>
                    <td>${product.quantity}</td>
                    <td>${price.toFixed(2)} грн</td>
                    <td>${totalPrice} грн</td>
                </tr>
            `;
        });

        return `
            <h2>Дякуємо за ваше замовлення!</h2>
            <p>Інформація про замовлення:</p>
            <p><strong>Номер замовлення:</strong> ${orderId}</p>
            <table border="1" cellspacing="0" cellpadding="5">
                <thead>
                    <tr>
                        <th>Назва продукту</th>
                        <th>Кількість</th>
                        <th>Ціна за одиницю</th>
                        <th>Загальна сума</th>
                    </tr>
                </thead>
                <tbody>
                    ${productRows}
                </tbody>
            </table>
            <p><strong>Загальна сума замовлення:</strong> ${total_price.toFixed(2)} грн</p>
            <h3>Деталі доставки:</h3>
            <p><strong>Спосіб доставки:</strong> ${delivery_method}</p>
            <p><strong>Адреса:</strong> ${address}, ${city}</p>
            <p><strong>Спосіб оплати:</strong> ${payment_method}</p>
        `;
    };

    const orderHTML = generateOrderHTML();

    const userMailOptions = {
        from: 'tactical.forma@gmail.com',
        to: guest_email,
        subject: `Підтвердження замовлення №${orderId}`,
        html: orderHTML
    };

    const adminMailOptions = {
        from: 'tactical.forma@gmail.com',
        to: 'tactical.forma@gmail.com',
        subject: `Нове замовлення на сайті №${orderId}`,
        html: `
            <h2>Нове замовлення №${orderId}</h2>
            <p><strong>Ім'я клієнта:</strong> ${guest_name}</p>
            <p><strong>Email клієнта:</strong> ${guest_email}</p>
            <p><strong>Телефон:</strong> ${guest_phone}</p>
            <p><strong>Спосіб доставки:</strong> ${delivery_method}</p> <!-- Додано delivery_method -->
            <p><strong>Загальна сума:</strong> ${total_price.toFixed(2)} грн</p>
            <p>Перевірте систему для деталей.</p>
        `
    };

    // Відправка листа замовнику
    transporter.sendMail(userMailOptions, (err, info) => {
        if (err) {
            //console.error(`[Лист замовнику] Помилка при відправленні листа: ${err.message}`);
        } else {
            //console.log(`[Лист замовнику] Успішно відправлено лист на email: ${guest_email}`);
        }
    });

    // Відправка листа адміну
    transporter.sendMail(adminMailOptions, (err, info) => {
        if (err) {
            //console.error(`[Лист адміну] Помилка при відправленні листа: ${err.message}`);

        } else {
            //console.log(`[Лист адміну] Успішно відправлено лист адміну.`);
        }
    });
}
