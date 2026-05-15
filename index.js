const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const pool = require("./db"); // Import the database pool to use in the new route
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "CAVO Backend is running" });
});

// Essential images route (moved from products.js to be a top-level route)
app.get("/api/essential-images", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM essential_images ORDER BY id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching essential images:", err); // Log the error on the server
    res.json([]); // Fallback: return empty array as per original logic
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
