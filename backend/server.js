const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "appdb",
  user: process.env.DB_USER || "appuser",
  password: process.env.DB_PASSWORD
});

const isId = (v) => Number.isInteger(Number(v)) && Number(v) > 0;
const fail = (res, code, msg) => res.status(code).json({ error: msg });

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
    const result = await pool.query("SELECT message FROM app_messages ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    fail(res, 500, "Could not load messages");
  }
});

app.get("/api/statistik", async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM buku)::int AS judul,
        (SELECT COALESCE(SUM(stok), 0) FROM buku)::int AS tersedia,
        (SELECT COUNT(*) FROM anggota)::int AS anggota,
        (SELECT COUNT(*) FROM peminjaman WHERE tgl_kembali IS NULL)::int AS dipinjam`);
    res.json(r.rows[0]);
  } catch (err) {
    fail(res, 500, "Gagal memuat statistik");
  }
});

app.get("/api/buku", async (req, res) => {
  const q = String(req.query.q || "").trim();
  try {
    const r = await pool.query(
      `SELECT id, judul, penulis, tahun, kategori, stok FROM buku
       WHERE $1 = '' OR judul ILIKE '%' || $1 || '%' OR penulis ILIKE '%' || $1 || '%'
       ORDER BY judul`, [q]);
    res.json(r.rows);
  } catch (err) {
    fail(res, 500, "Gagal memuat buku");
  }
});

app.post("/api/buku", async (req, res) => {
  const b = req.body || {};
  const judul = String(b.judul ?? "").trim();
  const penulis = String(b.penulis ?? "").trim();
  const kategori = String(b.kategori ?? "").trim() || "Umum";
  const tahun = b.tahun === "" || b.tahun == null ? null : Number(b.tahun);
  const stok = b.stok === "" || b.stok == null ? 1 : Number(b.stok);
  if (!judul || !penulis) return fail(res, 400, "Judul dan penulis wajib diisi");
  if (tahun !== null && !Number.isInteger(tahun)) return fail(res, 400, "Tahun harus berupa angka");
  if (!Number.isInteger(stok) || stok < 0) return fail(res, 400, "Stok harus angka 0 atau lebih");
  try {
    const r = await pool.query(
      "INSERT INTO buku (judul, penulis, tahun, kategori, stok) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [judul, penulis, tahun, kategori, stok]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return fail(res, 409, "Buku dengan judul dan penulis itu sudah ada");
    fail(res, 500, "Gagal menambah buku");
  }
});

app.delete("/api/buku/:id", async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "ID tidak valid");
  try {
    const r = await pool.query("DELETE FROM buku WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return fail(res, 404, "Buku tidak ditemukan");
    res.json({ deleted: true });
  } catch (err) {
    fail(res, 500, "Gagal menghapus buku");
  }
});

app.get("/api/anggota", async (_req, res) => {
  try {
    const r = await pool.query("SELECT id, nama, email FROM anggota ORDER BY nama");
    res.json(r.rows);
  } catch (err) {
    fail(res, 500, "Gagal memuat anggota");
  }
});

app.post("/api/anggota", async (req, res) => {
  const nama = String((req.body || {}).nama ?? "").trim();
  const email = String((req.body || {}).email ?? "").trim().toLowerCase();
  if (!nama || !email) return fail(res, 400, "Nama dan email wajib diisi");
  try {
    const r = await pool.query(
      "INSERT INTO anggota (nama, email) VALUES ($1,$2) RETURNING id", [nama, email]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return fail(res, 409, "Email sudah terdaftar");
    fail(res, 500, "Gagal menambah anggota");
  }
});

app.delete("/api/anggota/:id", async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "ID tidak valid");
  try {
    const r = await pool.query("DELETE FROM anggota WHERE id = $1", [req.params.id]);
    if (r.rowCount === 0) return fail(res, 404, "Anggota tidak ditemukan");
    res.json({ deleted: true });
  } catch (err) {
    fail(res, 500, "Gagal menghapus anggota");
  }
});

app.get("/api/peminjaman", async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.id, b.judul, a.nama,
             to_char(p.tgl_pinjam, 'YYYY-MM-DD') AS tgl_pinjam,
             to_char(p.tgl_kembali, 'YYYY-MM-DD') AS tgl_kembali
      FROM peminjaman p
      JOIN buku b ON b.id = p.buku_id
      JOIN anggota a ON a.id = p.anggota_id
      ORDER BY p.id DESC`);
    res.json(r.rows);
  } catch (err) {
    fail(res, 500, "Gagal memuat peminjaman");
  }
});

app.post("/api/peminjaman", async (req, res) => {
  const { buku_id, anggota_id } = req.body || {};
  if (!isId(buku_id) || !isId(anggota_id)) return fail(res, 400, "Pilih buku dan anggota");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      "UPDATE buku SET stok = stok - 1 WHERE id = $1 AND stok > 0 RETURNING id", [buku_id]);
    if (upd.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 409, "Stok buku habis atau buku tidak ditemukan");
    }
    const ins = await client.query(
      "INSERT INTO peminjaman (buku_id, anggota_id) VALUES ($1,$2) RETURNING id",
      [buku_id, anggota_id]);
    await client.query("COMMIT");
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23503") return fail(res, 400, "Anggota tidak ditemukan");
    fail(res, 500, "Gagal mencatat peminjaman");
  } finally {
    client.release();
  }
});

app.put("/api/peminjaman/:id/kembali", async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "ID tidak valid");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const upd = await client.query(
      "UPDATE peminjaman SET tgl_kembali = CURRENT_DATE WHERE id = $1 AND tgl_kembali IS NULL RETURNING buku_id",
      [req.params.id]);
    if (upd.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Peminjaman tidak ditemukan atau sudah dikembalikan");
    }
    await client.query("UPDATE buku SET stok = stok + 1 WHERE id = $1", [upd.rows[0].buku_id]);
    await client.query("COMMIT");
    res.json({ returned: true });
  } catch (err) {
    await client.query("ROLLBACK");
    fail(res, 500, "Gagal mencatat pengembalian");
  } finally {
    client.release();
  }
});

const startServer = (listenPort = port) => app.listen(listenPort, "0.0.0.0", () => {
  console.log(`Backend listening on port ${listenPort}`);
});

if (require.main === module) {
  startServer();
}

module.exports = { app, pool, startServer };