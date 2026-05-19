const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET semua order
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY created_at DESC",
    );
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

  console.log("🚀 --- NEW ORDER REQUEST RECEIVED ---");
  console.log("Customer:", customer_name);
  console.log("Phone:", customer_phone);
  console.log("Address:", customer_address);
  console.log("Items received:", JSON.stringify(items, null, 2));
  console.log("Total price:", total_price);
  console.log("Payment method:", payment_method);

  if (!items || items.length === 0) {
    console.error("❌ No items in order");
    return res.status(400).json({ error: "Tidak ada item dalam pesanan" });
  }

  const orderNumber = `CAVO-${Date.now()}`;
  const orderDate = new Date();

  try {
    // Validasi stok untuk semua item
    for (const item of items) {
      console.log(`🔍 Looking for product: "${item.product_name}"`);

      const productResult = await pool.query(
        "SELECT * FROM products WHERE name = $1",
        [item.product_name],
      );
      const product = productResult.rows[0];

      if (!product) {
        console.error(
          `❌ Product "${item.product_name}" NOT FOUND in database!`,
        );
        console.log("Available products in database:");
        const allProducts = await pool.query("SELECT name FROM products");
        console.log(allProducts.rows.map((p) => p.name).join(", "));
        return res.status(400).json({
          error: `Produk ${item.product_name} tidak ditemukan di database`,
          availableProducts: allProducts.rows.map((p) => p.name),
        });
      }

      console.log(`✅ Product found:`, {
        id: product.id,
        name: product.name,
        stock_s: product.stock_s,
        stock_m: product.stock_m,
        stock_l: product.stock_l,
        stock_xl: product.stock_xl,
      });

      // Cek stok sesuai ukuran
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
        console.error(
          `❌ Stock insufficient for ${item.product_name} size ${item.size}. Available: ${currentStock}, Requested: ${item.quantity}`,
        );
        return res.status(400).json({
          error: `Stok ${item.product_name} ukuran ${item.size} tidak mencukupi. Tersisa: ${currentStock} pcs`,
        });
      }

      console.log(`✅ Stock OK for ${item.product_name} size ${item.size}`);
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

    console.log(`✅ Order created successfully: ${orderNumber}`);
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

  console.log(`🔄 Updating order ${id} status to: ${status}`);

  try {
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [
      id,
    ]);
    const order = orderResult.rows[0];

    if (!order) {
      console.error(`❌ Order ${id} not found`);
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

    console.log(`Order ${id}: ${oldStatus} -> ${newStatus}`);
    console.log(`Items:`, JSON.stringify(items, null, 2));

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

        console.log(
          `Before stock update for ${item.product_name}: S=${stock_s}, M=${stock_m}, L=${stock_l}, XL=${stock_xl}`,
        );

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
          console.log(
            `Stock reduced for ${item.product_name} size ${item.size} by ${item.quantity}`,
          );
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
          console.log(
            `Stock increased for ${item.product_name} size ${item.size} by ${item.quantity}`,
          );
        }

        if (stock_s < 0 || stock_m < 0 || stock_l < 0 || stock_xl < 0) {
          console.error(
            `❌ Negative stock would occur for ${item.product_name}`,
          );
          return res.status(400).json({ error: "Stok menjadi negatif" });
        }

        const totalStok = stock_s + stock_m + stock_l + stock_xl;

        await pool.query(
          "UPDATE products SET stock_s = $1, stock_m = $2, stock_l = $3, stock_xl = $4, total_stok = $5 WHERE id = $6",
          [stock_s, stock_m, stock_l, stock_xl, totalStok, product.id],
        );

        console.log(
          `After stock update for ${item.product_name}: S=${stock_s}, M=${stock_m}, L=${stock_l}, XL=${stock_xl}`,
        );
      }
    }

    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [
      newStatus,
      id,
    ]);
    console.log(`✅ Order ${id} status updated to ${newStatus}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Update status error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
