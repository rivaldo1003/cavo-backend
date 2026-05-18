const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Konfigurasi multer untuk upload file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../frontend/public/uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// GET semua produk
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM products ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching products:", err); // Log the detailed error on the server
    res.status(500).json({ error: "Failed to fetch products." }); // Send a generic message to the client
  }
});

// UPDATE stok produk
router.put("/:id/stock", async (req, res) => {
  const { id } = req.params;

  // Validasi jika body tidak ada
  if (!req.body) {
    return res
      .status(400)
      .json({ error: "Data stok tidak ditemukan dalam permintaan" });
  }

  // Pastikan nilai adalah angka untuk menghindari penggabungan string (concatenation)
  const s = parseInt(req.body.stock_s) || 0;
  const m = parseInt(req.body.stock_m) || 0;
  const l = parseInt(req.body.stock_l) || 0;
  const xl = parseInt(req.body.stock_xl) || 0;

  const totalStok = s + m + l + xl;

  try {
    await pool.query(
      "UPDATE products SET stock_s = $1, stock_m = $2, stock_l = $3, stock_xl = $4, total_stok = $5 WHERE id = $6",
      [s, m, l, xl, totalStok, id],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating stock:", err);
    res.status(500).json({ error: "Gagal memperbarui stok produk." });
  }
});

// UPDATE detail produk
router.put("/:id/details", async (req, res) => {
  const { id } = req.params;
  const { name, gelar, theme, price } = req.body;

  try {
    await pool.query(
      "UPDATE products SET name = $1, gelar = $2, theme = $3, price = $4 WHERE id = $5",
      [name, gelar, theme, price, id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE foto produk (upload)
router.post("/:id/upload", upload.single("image"), async (req, res) => {
  const { id } = req.params;
  const imageUrl = `/uploads/${req.file.filename}`;

  try {
    await pool.query("UPDATE products SET image_url = $1 WHERE id = $2", [
      imageUrl,
      id,
    ]);
    res.json({ success: true, imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// routes/products.js - Hapus atau ganti endpoint /essential-images yang lama dengan kode ini
router.get("/essential-images", async (req, res) => {
  try {
    // Query khusus untuk tabel essential_images
    const result = await pool.query(
      "SELECT * FROM essential_images ORDER BY id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching essential images:", err.message);
    // Kirim array kosong agar frontend tidak error, gambar akan pakai fallback
    res.json([]);
  }
});
module.exports = router;
