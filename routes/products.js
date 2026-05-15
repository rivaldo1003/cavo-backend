const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Konfigurasi multer untuk upload file - PAKAI ABSOLUTE PATH
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Absolute path ke frontend public/uploads
    const uploadDir =
      "/Users/tifaniadwisafitri/development/Backend/cavo-fashion/public/uploads";

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
    res.status(500).json({ error: err.message });
  }
});

// UPDATE stok produk
router.put("/:id/stock", async (req, res) => {
  const { id } = req.params;
  const { stock_s, stock_m, stock_l, stock_xl } = req.body;
  const totalStok =
    (stock_s || 0) + (stock_m || 0) + (stock_l || 0) + (stock_xl || 0);

  try {
    await pool.query(
      "UPDATE products SET stock_s = $1, stock_m = $2, stock_l = $3, stock_xl = $4, total_stok = $5 WHERE id = $6",
      [stock_s, stock_m, stock_l, stock_xl, totalStok, id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

// GET essential images
router.get("/essential-images", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM essential_images ORDER BY id",
    );
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

module.exports = router;
