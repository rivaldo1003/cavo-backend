const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET semua order
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC",
    );
    // Parse items JSON untuk setiap order
    const orders = result.rows.map((order) => ({
      ...order,
      items: order.items
        ? typeof order.items === "string"
          ? JSON.parse(order.items)
          : order.items
        : [],
    }));
    res.json(orders);
  } catch (err) {
    console.error("GET orders error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST order baru (support multi items)
router.post("/", async (req, res) => {
  const {
    customer_name,
    customer_phone,
    customer_address,
    items,
    total_price,
    payment_method,
    notes,
  } = req.body;

  console.log("📦 Received order:", {
    customer_name,
    itemsCount: items?.length,
    total_price,
  });

  if (!items || items.length === 0) {
    return res.status(400).json({ error: "Tidak ada item dalam pesanan" });
  }

  const orderNumber = `CAVO-${Date.now()}`;
  const orderDate = new Date();

  try {
    // Validasi stok untuk semua item
    for (const item of items) {
      console.log(
        `🔍 Cek stok: ${item.product_name} - ${item.size} x${item.quantity}`,
      );

      const productResult = await pool.query(
        "SELECT * FROM products WHERE name = $1",
        [item.product_name],
      );
      const product = productResult.rows[0];

      if (!product) {
        return res
          .status(400)
          .json({ error: `Produk ${item.product_name} tidak ditemukan` });
      }

      let stockAvailable = false;
      let currentStock = 0;
      switch (item.size) {
        case "S":
          stockAvailable = product.stock_s >= item.quantity;
          currentStock = product.stock_s;
          break;
        case "M":
          stockAvailable = product.stock_m >= item.quantity;
          currentStock = product.stock_m;
          break;
        case "L":
          stockAvailable = product.stock_l >= item.quantity;
          currentStock = product.stock_l;
          break;
        case "XL":
          stockAvailable = product.stock_xl >= item.quantity;
          currentStock = product.stock_xl;
          break;
        default:
          stockAvailable = false;
      }

      if (!stockAvailable) {
        return res.status(400).json({
          error: `Stok ${item.product_name} ukuran ${item.size} tidak mencukupi. Tersisa: ${currentStock} pcs`,
        });
      }
    }

    // Simpan order
    const result = await pool.query(
      `INSERT INTO orders (order_number, customer_name, customer_phone, customer_address, items, total_price, payment_method, notes, status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9) RETURNING *`,
      [
        orderNumber,
        customer_name,
        customer_phone,
        customer_address,
        JSON.stringify(items),
        total_price,
        payment_method,
        notes || "",
        orderDate,
      ],
    );

    console.log(`✅ Order created: ${orderNumber}`);
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    console.error("❌ Order error:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE status order (dengan rollback stok)
router.put("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [
      id,
    ]);
    const order = orderResult.rows[0];

    if (!order) {
      return res.status(404).json({ error: "Order tidak ditemukan" });
    }

    const oldStatus = order.status;
    const newStatus = status;
    let items = order.items;

    if (typeof items === "string") {
      items = JSON.parse(items);
    }

    if (!items || items.length === 0) {
      items = [];
    }

    for (const item of items) {
      const productResult = await pool.query(
        "SELECT * FROM products WHERE name = $1",
        [item.product_name],
      );
      const product = productResult.rows[0];

      if (product) {
        let stock_s = product.stock_s;
        let stock_m = product.stock_m;
        let stock_l = product.stock_l;
        let stock_xl = product.stock_xl;

        if (newStatus === "paid" && oldStatus !== "paid") {
          switch (item.size) {
            case "S":
              stock_s -= item.quantity;
              break;
            case "M":
              stock_m -= item.quantity;
              break;
            case "L":
              stock_l -= item.quantity;
              break;
            case "XL":
              stock_xl -= item.quantity;
              break;
          }
        } else if (oldStatus === "paid" && newStatus !== "paid") {
          switch (item.size) {
            case "S":
              stock_s += item.quantity;
              break;
            case "M":
              stock_m += item.quantity;
              break;
            case "L":
              stock_l += item.quantity;
              break;
            case "XL":
              stock_xl += item.quantity;
              break;
          }
        }

        if (stock_s < 0 || stock_m < 0 || stock_l < 0 || stock_xl < 0) {
          return res.status(400).json({ error: "Stok menjadi negatif" });
        }

        const totalStok = stock_s + stock_m + stock_l + stock_xl;

        await pool.query(
          "UPDATE products SET stock_s = $1, stock_m = $2, stock_l = $3, stock_xl = $4, total_stok = $5 WHERE id = $6",
          [stock_s, stock_m, stock_l, stock_xl, totalStok, product.id],
        );
      }
    }

    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [
      newStatus,
      id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Update status error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
