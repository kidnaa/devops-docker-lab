const express = require("express");
const { Pool } = require("pg");
const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({
 host: process.env.DB_HOST || "db",
 port: Number(process.env.DB_PORT || 5432),
 database: process.env.DB_NAME || "appdb",
 user: process.env.DB_USER || "appuser",
 password: process.env.DB_PASSWORD
});
app.get("/api/health", async (_req, res) => {
 try {
 await pool.query("SELECT 1");
 res.json({ status: "ok", database: "connected" });
 } catch (err) {
 res.status(503).json({ status: "degraded", database: "unavailable" });
 }
});
app.get("/api/messages", async (_req, res) => {
 try {
 const result = await pool.query(
 "SELECT message FROM app_messages ORDER BY id"
 );
 res.json(result.rows);
 } catch (err) {
 res.status(500).json({ error: "Could not load messages" });
 }
});
app.listen(port, "0.0.0.0", () => {
 console.log(`Backend listening on port ${port}`);
});
