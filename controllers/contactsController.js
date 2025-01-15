const db = require('../config/db');

// Отримати всі контакти
exports.getAllContacts = (req, res) => {
    const query = 'SELECT * FROM contacts';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
};

// Додати новий контакт
exports.createContact = (req, res) => {
    const { phone_number, email, viber_link, instagram_link, whatsapp_link, telegram_link } = req.body;
    const query = 'INSERT INTO contacts (phone_number, email, viber_link, instagram_link, whatsapp_link, telegram_link) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(query, [phone_number, email, viber_link, instagram_link, whatsapp_link, telegram_link], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Contact created successfully' });
    });
};

// Отримати контакт за ID
exports.getContactById = (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM contacts WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: 'Contact not found' });
        res.json(results[0]);
    });
};

// Оновити контакт
exports.updateContact = (req, res) => {
    const { id } = req.params;
    const { phone_number, email, viber_link, instagram_link, whatsapp_link, telegram_link } = req.body;
    const query = 'UPDATE contacts SET phone_number = ?, email = ?, viber_link = ?, instagram_link = ?, whatsapp_link = ?, telegram_link = ? WHERE id = ?';
    db.query(query, [phone_number, email, viber_link, instagram_link, whatsapp_link, telegram_link, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Contact updated successfully' });
    });
};

// Видалити контакт
exports.deleteContact = (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM contacts WHERE id = ?';
    db.query(query, [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Contact deleted successfully' });
    });
};
