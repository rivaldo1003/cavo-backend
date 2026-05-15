const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const productsRouter = require("./routes/products");
const ordersRouter = require("./routes/orders"); // ✅ HANYA SEKALI

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter); // ✅ HANYA SEKALI
app.use("/api/essential-images", productsRouter); // Ini akan membuat semua route di productsRouter bisa diakses via /api/essential-images juga, yang mungkin bukan yang Anda mau.

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "CAVO Backend is running" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
