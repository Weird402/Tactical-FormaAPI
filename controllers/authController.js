const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.registerAdmin = (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Перевіряємо, чи існує адміністратор з таким email
    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkQuery, [email], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
        if (results.length > 0) {
            return res.status(400).json({ error: 'Admin with this email already exists' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        db.query(query, [name, email, hashedPassword], (err) => {
            if (err) return res.status(500).json({ error: 'Error creating admin: ' + err.message });
            res.status(201).json({ message: 'Admin registered successfully' });
        });
    });
};

exports.loginAdmin = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Запит тільки за email (без перевірки ролі)
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const admin = results[0];
        const isValidPassword = bcrypt.compareSync(password, admin.password);

        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Генерація JWT токена
        const token = jwt.sign(
            { id: admin.id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '12h' }
        );

        res.json({ token });
    });
};


// Вихід з системи
exports.logout = (req, res) => {
    res.json({ message: 'Logged out successfully' });
};

// Перевірка ролі адміністратора
exports.isAdmin = (req, res) => {
    res.json({ isAdmin: true });
};

