const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Importing cookie-parser
const path = require('path');


const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const cartRoutes = require('./routes/cart');
const favoriteRoutes = require('./routes/favorites');
const orderRoutes = require('./routes/orders');

dotenv.config();

const app = express();

// CORS configuration to allow credentials from all origins (be cautious)
app.use(cors({
    origin: (origin, callback) => {
        callback(null, true); // Дозволяє всі запити з будь-яких доменів
    },
    credentials: true
}));

app.use(bodyParser.json());
app.use(cookieParser()); // Add middleware to parse cookies
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Attach routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/cart', cartRoutes);
//app.use('/api/favorites', favoriteRoutes);
app.use('/api/orders', orderRoutes);

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
