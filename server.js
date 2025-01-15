const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Імпортування маршрутів
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const favoriteRoutes = require('./routes/favorites');
const orderRoutes = require('./routes/orders');
const contactsRoutes = require('./routes/contacts');
const colorRoutes = require('./routes/colorRoutes');
const reviewRoutes = require('./routes/reviews');
const liqpayRoutes = require('./routes/liqpayRoutes');


dotenv.config();

const app = express();

// Налаштування CORS
// app.use(cors({
//     origin: (origin, callback) => {
//         callback(null, true); // Дозволяє всі запити з будь-яких доменів
//     },
//     credentials: true
// }));
const allowedOrigins = [
    'https://tactical-forma.com'
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true, // Дозволяє передавати кукі
    allowedHeaders: ['Content-Type', 'Authorization'], // Дозволені заголовки
}));

// Middleware для обробки preflight запитів (OPTIONS)
app.options('*', cors());

// Логування запитів
app.use((req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    //console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${clientIp}`);
    next();
});

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());

// Роутинг API


app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/colors', colorRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/liqpay', liqpayRoutes);

// Обробка статичних файлів
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Puppeteer Middleware для рендерингу SEO
//app.get('/*', prerenderMiddleware);
//app.get(/^\/(?!api).*$/, prerenderMiddleware);

// Глобальний обробник помилок
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Access not allowed by CORS' });
    }
    res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    //console.log(`Server running on port ${PORT}`);
});
