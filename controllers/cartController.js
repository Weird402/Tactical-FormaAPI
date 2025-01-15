const db = require('../config/db');

// Додаємо товар до кошика
exports.addToCart = (req, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
        return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];

    // Перевіряємо, чи товар вже є в кошику
    const itemIndex = cart.findIndex(item => item.productId === productId);
    if (itemIndex > -1) {
        // Якщо товар вже є, оновлюємо його кількість
        cart[itemIndex].quantity += quantity;
    } else {
        // Якщо товару немає, додаємо його до кошика
        cart.push({ productId, quantity });
    }

    // Оновлюємо кукіс з новим кошиком
    res.cookie('cart', JSON.stringify(cart), { httpOnly: true });
    res.json({ message: 'Product added to cart', cart });
};

// Отримуємо вміст кошика
exports.getCart = (req, res) => {
    const cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
    console.log("Cart from cookies:", cart); // Додайте це для перевірки даних з кукі
    
    if (cart.length === 0) {
        return res.json([]); 
    }

    const productIds = cart.map(item => item.productId);
    console.log("Product IDs:", productIds); // Додайте це, щоб перевірити, що отримуємо з масиву cart

    const query = `
    SELECT products.*, GROUP_CONCAT(product_media.media_url) AS media_urls
    FROM products
    LEFT JOIN product_media ON products.id = product_media.product_id
    WHERE products.id IN (?)
    GROUP BY products.id
`;


    db.query(query, [productIds], (err, results) => {
        if (err) {
            console.error("Database error:", err); // Додайте це для відстеження помилок у запиті до бази даних
            return res.status(500).json({ error: err.message });
        }

        console.log("Query results:", results); // Перевіряємо, що повертає запит до бази даних

        const serverUrl = `${req.protocol}://${req.get('host')}`;

        const fullCartDetails = results.map(product => {
            const cartItem = cart.find(item => item.productId === product.id);
            return {
                ...product,
                quantity: cartItem.quantity,
                mediaUrls: product.media_urls ? product.media_urls.split(',').map(url => `${serverUrl}${url}`) : []
            };
        });

        console.log("Full cart details:", fullCartDetails); // Остаточний масив, який буде відправлено клієнту
        res.json(fullCartDetails);
    });
};



// Оновлюємо кількість товару в кошику
exports.updateCart = (req, res) => {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) {
        return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
        cart[itemIndex].quantity = quantity;
        res.cookie('cart', JSON.stringify(cart), { httpOnly: true });
        res.json({ message: 'Cart updated', cart });
    } else {
        res.status(404).json({ error: 'Product not found in cart' });
    }
};

// Видаляємо товар з кошика
exports.removeFromCart = (req, res) => {
    const { productId } = req.body;
    let cart = req.cookies.cart ? JSON.parse(req.cookies.cart) : [];
    cart = cart.filter(item => item.productId !== productId);

    res.cookie('cart', JSON.stringify(cart), { httpOnly: true });
    res.json({ message: 'Product removed from cart', cart });
};

// Очищаємо кошик
exports.clearCart = (req, res) => {
    res.cookie('cart', JSON.stringify([]), { httpOnly: true });
    res.json({ message: 'Cart cleared' });
};
