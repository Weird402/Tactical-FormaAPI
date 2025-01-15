"use strict";

var db = require('../config/db'); // Отримати всі замовлення


exports.getAllOrders = function (req, res) {
  var query = 'SELECT * FROM orders';
  db.query(query, function (err, results) {
    if (err) return res.status(500).json({
      error: err.message
    });
    res.json(results);
  });
}; // Отримати замовлення за ID


exports.getOrderById = function (req, res) {
  var query = 'SELECT * FROM orders WHERE id = ?';
  db.query(query, [req.params.id], function (err, result) {
    if (err) return res.status(500).json({
      error: err.message
    });
    res.json(result);
  });
}; // Створити замовлення для авторизованого користувача


exports.createOrder = function (req, res) {
  var _req$body = req.body,
      user_id = _req$body.user_id,
      products = _req$body.products,
      total_price = _req$body.total_price;
  var query = 'INSERT INTO orders (user_id, total_price, status) VALUES (?, ?, ?)';
  var status = 'Pending'; // Статус замовлення за замовчуванням

  db.query(query, [user_id, total_price, status], function (err, result) {
    if (err) return res.status(500).json({
      error: err.message
    });
    var orderId = result.insertId;
    var orderItemsQuery = 'INSERT INTO order_items (order_id, product_id, quantity) VALUES ?';
    var orderItems = products.map(function (product) {
      return [orderId, product.product_id, product.quantity];
    });
    db.query(orderItemsQuery, [orderItems], function (itemsErr) {
      if (itemsErr) return res.status(500).json({
        error: itemsErr.message
      });
      res.status(201).json({
        message: 'Order created successfully',
        orderId: orderId
      });
    });
  });
}; // Створити замовлення для неавторизованого користувача


exports.createOrderForGuest = function (req, res) {
  var _req$body2 = req.body,
      guest_name = _req$body2.guest_name,
      guest_email = _req$body2.guest_email,
      guest_phone = _req$body2.guest_phone,
      address = _req$body2.address,
      city = _req$body2.city,
      products = _req$body2.products,
      total_price = _req$body2.total_price; // Додаємо адресу та місто до таблиці guests

  var guestQuery = 'INSERT INTO guests (name, email, phone, address, city) VALUES (?, ?, ?, ?, ?)';
  db.query(guestQuery, [guest_name, guest_email, guest_phone, address, city], function (guestErr, guestResult) {
    if (guestErr) return res.status(500).json({
      error: guestErr.message
    });
    var guestId = guestResult.insertId;
    var orderQuery = 'INSERT INTO orders (guest_id, total_price, status) VALUES (?, ?, ?)';
    var orderStatus = 'Pending';
    db.query(orderQuery, [guestId, total_price, orderStatus], function (orderErr, orderResult) {
      if (orderErr) return res.status(500).json({
        error: orderErr.message
      });
      var orderId = orderResult.insertId;
      var orderItemsQuery = 'INSERT INTO order_items (order_id, product_id, quantity) VALUES ?';
      var orderItems = products.map(function (product) {
        return [orderId, product.product_id, product.quantity];
      });
      db.query(orderItemsQuery, [orderItems], function (itemsErr) {
        if (itemsErr) return res.status(500).json({
          error: itemsErr.message
        });
        res.status(201).json({
          message: 'Order created successfully for guest',
          orderId: orderId
        });
      });
    });
  });
}; // Оновити замовлення


exports.updateOrder = function (req, res) {
  var status = req.body.status;
  var query = 'UPDATE orders SET status = ? WHERE id = ?';
  db.query(query, [status, req.params.id], function (err) {
    if (err) return res.status(500).json({
      error: err.message
    });
    res.json({
      message: 'Order updated successfully'
    });
  });
}; // Видалити замовлення


exports.deleteOrder = function (req, res) {
  var query = 'DELETE FROM orders WHERE id = ?';
  db.query(query, [req.params.id], function (err) {
    if (err) return res.status(500).json({
      error: err.message
    });
    res.json({
      message: 'Order deleted successfully'
    });
  });
};

exports.getGuestOrderById = function (req, res) {
  var query = 'SELECT * FROM guests WHERE id = ?';
  db.query(query, [req.params.id], function (err, result) {
    if (err) return res.status(500).json({
      error: err.message
    });
    res.json(result);
  });
};

exports.getOrderProductsById = function (req, res) {
  var order_id = req.params.order_id; // Get the order ID from the request parameters

  db.query("\n        SELECT \n            p.id AS product_id, \n            p.name, \n            p.description, \n            p.price, \n            p.stock_quantity, \n            p.image_url, \n            oi.quantity\n        FROM order_items oi\n        JOIN products p ON oi.product_id = p.id\n        WHERE oi.order_id = ?", [order_id], function (err, orderItems) {
    if (err) {
      res.status(500).json({
        error: 'Failed to retrieve order: ' + err.message
      });
    } else {
      res.json(orderItems);
    }
  });
};