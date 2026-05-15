const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET semua order
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST order baru (cek stok sebelum order)
router.post("/", async (req, res) => {
  const {
    customer_name,
    customer_phone,
    customer_address,
    product_name,
    product_gelar,
    size,
    quantity,
    total_price,
    payment_method,
    notes,
  } = req.body;
  const orderNumber = `CAVO-${Date.now()}`;

  try {
    // Cek stok produk
    const productResult = await pool.query(
      "SELECT * FROM products WHERE name = $1",
      [product_name],
    );
    const product = productResult.rows[0];

    if (!product) {
      return res.status(400).json({ error: "Produk tidak ditemukan" });
    }

    // Cek stok sesuai ukuran
    let stockAvailable = false;
    switch (size) {
      case "S":
        stockAvailable = product.stock_s >= quantity;
        break;
      case "M":
        stockAvailable = product.stock_m >= quantity;
        break;
      case "L":
        stockAvailable = product.stock_l >= quantity;
        break;
      case "XL":
        stockAvailable = product.stock_xl >= quantity;
        break;
      default:
        stockAvailable = false;
    }

    if (!stockAvailable) {
      return res.status(400).json({ error: "Stok tidak mencukupi" });
    }

    // Simpan order
    const result = await pool.query(
      `INSERT INTO orders (order_number, customer_name, customer_phone, customer_address, product_name, product_gelar, size, quantity, total_price, payment_method, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending') RETURNING *`,
      [
        orderNumber,
        customer_name,
        customer_phone,
        customer_address,
        product_name,
        product_gelar,
        size,
        quantity,
        total_price,
        payment_method,
        notes,
      ],
    );
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE status order (dengan rollback stok)
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Ambil order dulu
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [
      id,
    ]);
    const order = orderResult.rows[0];

    if (!order) {
      return res.status(404).json({ error: "Order tidak ditemukan" });
    }

    const oldStatus = order.status;
    const newStatus = status;

    // Ambil produk
    const productResult = await pool.query(
      "SELECT * FROM products WHERE name = $1",
      [order.product_name],
    );
    const product = productResult.rows[0];

    if (product) {
      let stock_s = product.stock_s;
      let stock_m = product.stock_m;
      let stock_l = product.stock_l;
      let stock_xl = product.stock_xl;

      // Jika status berubah dari 'pending' ke 'paid' → kurangi stok
      if (newStatus === "paid" && oldStatus !== "paid") {
        switch (order.size) {
          case "S":
            stock_s -= order.quantity;
            break;
          case "M":
            stock_m -= order.quantity;
            break;
          case "L":
            stock_l -= order.quantity;
            break;
          case "XL":
            stock_xl -= order.quantity;
            break;
        }
      }

      // Jika status berubah dari 'paid' ke selain 'paid' (pending/cancelled) → rollback stok
      else if (oldStatus === "paid" && newStatus !== "paid") {
        switch (order.size) {
          case "S":
            stock_s += order.quantity;
            break;
          case "M":
            stock_m += order.quantity;
            break;
          case "L":
            stock_l += order.quantity;
            break;
          case "XL":
            stock_xl += order.quantity;
            break;
        }
      }

      // Validasi stok tidak negatif
      if (stock_s < 0 || stock_m < 0 || stock_l < 0 || stock_xl < 0) {
        return res.status(400).json({ error: "Stok menjadi negatif" });
      }

      const totalStok = stock_s + stock_m + stock_l + stock_xl;

      await pool.query(
        "UPDATE products SET stock_s = $1, stock_m = $2, stock_l = $3, stock_xl = $4, total_stok = $5 WHERE id = $6",
        [stock_s, stock_m, stock_l, stock_xl, totalStok, product.id],
      );
    }

    // Update status order
    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [
      newStatus,
      id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
