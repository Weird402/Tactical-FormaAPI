const crypto = require("crypto");
const axios = require("axios");

// LiqPay ключі
const LIQPAY_PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY;
const LIQPAY_PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY;

// Контролер для обробки запиту
const processPayment = async (req, res) => {
  try {
    const { amount, order_id, payment_token,description } = req.body;

    if (!amount || !order_id || !payment_token||!description) {
      return res.status(400).json({ error: "Необхідні параметри не передані" });
    }

    const gpayToken = Buffer.from(JSON.stringify(payment_token)).toString("base64");

    const requestData = {
      public_key: LIQPAY_PUBLIC_KEY,
      version: "3",
      action: "pay",
      paytype: "gpay",
      amount: amount,
      gpay_token: gpayToken,
      currency: "UAH",
      description: "Оплата через Google Pay, від:" + description,
      order_id: order_id,
      language: "uk",
      result_url: "https://tactical-forma.com/",
      server_url: "https://api.tactical-forma.com/api/liqpay/payment",
      sandbox: "0",
    };

    const data = Buffer.from(JSON.stringify(requestData)).toString("base64");
    const signature = crypto
      .createHash("sha1")
      .update(LIQPAY_PRIVATE_KEY + data + LIQPAY_PRIVATE_KEY)
      .digest("base64");

    const response = await axios.post(
      "https://www.liqpay.ua/api/request",
      `data=${data}&signature=${signature}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { result, err_code, err_params, redirect_to } = response.data;

    res.status(200).json({
      result,
      err_code,
      err_params,
      redirect_to,
    });
  } catch (error) {
    res.status(500).json({
      error: "Помилка під час обробки запиту до LiqPay",
      details: error.response ? error.response.data : error.message,
    });
  }
};

module.exports = { processPayment };