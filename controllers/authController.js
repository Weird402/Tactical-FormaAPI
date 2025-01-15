const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Реєстрація адміністратора
exports.registerAdmin = (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkQuery, [email], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
        if (results.length > 0) {
            return res.status(400).json({ error: 'Admin with this email already exists' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const query = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
        db.query(query, [username, email, hashedPassword, 'admin'], (err) => {
            if (err) return res.status(500).json({ error: 'Error creating admin: ' + err.message });
            res.status(201).json({ message: 'Admin registered successfully' });
        });
    });
};


// Логін адміністратора
exports.loginAdmin = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const query = 'SELECT * FROM users WHERE email = ? AND role = "admin"';
    db.query(query, [email], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const admin = results[0];
        const isValidPassword = bcrypt.compareSync(password, admin.password);

        if (!isValidPassword) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: admin.id, role: admin.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '12h' }
        );

        res.json({ token });
    });
};

// Вихід з системи адміністратора
exports.logoutAdmin = (req, res) => {
    res.json({ message: 'Logged out successfully' });
};

// Перевірка ролі адміністратора
exports.isAdmin = (req, res) => {
    const isAdmin = req.user.role === 'admin';
    res.json({ isAdmin });
};
