// contactsRoutes.js
const express = require('express');
const router = express.Router();
const contactsController = require('../controllers/contactsController');
const { authenticateToken, isAdmin } = require('../middlewares/authMiddleware');


router.get('/', contactsController.getAllContacts);
router.post('/', authenticateToken, isAdmin, contactsController.createContact);
router.get('/:id', contactsController.getContactById);
router.put('/:id', authenticateToken, isAdmin, contactsController.updateContact);
router.delete('/:id', authenticateToken, isAdmin, contactsController.deleteContact);

module.exports = router;
