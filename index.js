const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders");
const pool = require("./db");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS - izinkan semua origin
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// Routes
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);

// Rute khusus untuk mengambil data dari tabel essential_images
app.get("/api/essential-images", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM essential_images ORDER BY id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching essential images:", err);
    res.status(500).json({ error: "Failed to fetch essential images" });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "CAVO Backend is running" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
