const express = require("express");
//const { processPayment } = require("./liqpayControler");
const { processPayment } = require("../controllers/liqpayControler");

const router = express.Router();

// Маршрут для обробки платежу
router.post("/payment", processPayment);

module.exports = router;
