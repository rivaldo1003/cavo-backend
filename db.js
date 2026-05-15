const { Pool } = require("pg");
require("dotenv").config();

// Hanya gunakan DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL tidak ditemukan!");
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

// Test koneksi
pool.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Database connected successfully");
  }
});

module.exports = pool;
