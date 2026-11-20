const request = require("supertest");

const mockPool = {
  query: jest.fn(),
  connect: jest.fn()
};

jest.mock("pg", () => ({
  Pool: jest.fn(() => mockPool)
}));

const { app, startServer } = require("./server");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("server startup", () => {
  test("can start and stop the HTTP server", (done) => {
    const server = startServer(0);
    server.on("listening", () => {
      server.close(done);
    });
    server.on("error", done);
  });
});

describe("API health", () => {
  test("returns ok when PostgreSQL is available", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "connected" });
  });

  test("returns degraded status when PostgreSQL fails", async () => {
    mockPool.query.mockRejectedValue(new Error("database unavailable"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
  });

  test("loads or rejects application messages", async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ message: "ok" }] });
    const success = await request(app).get("/api/messages");

    mockPool.query.mockRejectedValueOnce(new Error("database"));
    const failure = await request(app).get("/api/messages");

    expect(success.status).toBe(200);
    expect(failure.status).toBe(500);
  });
});

describe("books", () => {
  test("loads statistics", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ judul: 3, tersedia: 5, anggota: 2, dipinjam: 1 }]
    });

    const res = await request(app).get("/api/statistik");

    expect(res.status).toBe(200);
    expect(res.body.judul).toBe(3);
  });

  test("searches books", async () => {
    mockPool.query.mockResolvedValue({
      rows: [{ id: 1, judul: "Clean Code", penulis: "Robert Martin", stok: 2 }]
    });

    const res = await request(app).get("/api/buku?q=Clean");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test("handles book loading errors", async () => {
    mockPool.query.mockRejectedValue(new Error("database"));

    const res = await request(app).get("/api/buku");

    expect(res.status).toBe(500);
  });

  test("rejects a book without required fields", async () => {
    const res = await request(app).post("/api/buku").send({ judul: "", penulis: "" });

    expect(res.status).toBe(400);
  });

  test("validates year and stock", async () => {
    const invalidYear = await request(app).post("/api/buku").send({
      judul: "Buku", penulis: "Penulis", tahun: "abad", stok: 1
    });
    const invalidStock = await request(app).post("/api/buku").send({
      judul: "Buku", penulis: "Penulis", tahun: 2026, stok: -1
    });

    expect(invalidYear.status).toBe(400);
    expect(invalidStock.status).toBe(400);
  });

  test("creates a book", async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 10 }] });

    const res = await request(app).post("/api/buku").send({
      judul: "Clean Code",
      penulis: "Robert Martin",
      tahun: 2008,
      kategori: "Teknologi",
      stok: 3
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 10 });
  });

  test("handles duplicate and database errors when creating books", async () => {
    mockPool.query.mockRejectedValueOnce({ code: "23505" });
    mockPool.query.mockRejectedValueOnce(new Error("database"));

    const duplicate = await request(app).post("/api/buku").send({
      judul: "Buku", penulis: "Penulis"
    });
    const failure = await request(app).post("/api/buku").send({
      judul: "Buku 2", penulis: "Penulis"
    });

    expect(duplicate.status).toBe(409);
    expect(failure.status).toBe(500);
  });

  test("validates and deletes a book", async () => {
    const invalid = await request(app).delete("/api/buku/abc");
    mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
    const missing = await request(app).delete("/api/buku/99");
    mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
    const deleted = await request(app).delete("/api/buku/1");

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
    expect(deleted.status).toBe(200);
  });

  test("handles book deletion errors", async () => {
    mockPool.query.mockRejectedValue(new Error("database"));

    const res = await request(app).delete("/api/buku/1");

    expect(res.status).toBe(500);
  });
});

describe("members", () => {
  test("loads members", async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 1, nama: "Andi", email: "andi@example.com" }] });

    const res = await request(app).get("/api/anggota");

    expect(res.status).toBe(200);
  });

  test("handles member loading errors", async () => {
    mockPool.query.mockRejectedValue(new Error("database"));

    const res = await request(app).get("/api/anggota");

    expect(res.status).toBe(500);
  });

  test("rejects missing member fields", async () => {
    const res = await request(app).post("/api/anggota").send({ nama: "", email: "" });

    expect(res.status).toBe(400);
  });

  test("creates a member", async () => {
    mockPool.query.mockResolvedValue({ rows: [{ id: 2 }] });

    const res = await request(app).post("/api/anggota").send({
      nama: "Andi",
      email: "ANDI@example.com"
    });

    expect(res.status).toBe(201);
  });

  test("handles duplicate and database errors for members", async () => {
    mockPool.query.mockRejectedValueOnce({ code: "23505" });
    mockPool.query.mockRejectedValueOnce(new Error("database"));

    const duplicate = await request(app).post("/api/anggota").send({
      nama: "Andi", email: "andi@example.com"
    });
    const failure = await request(app).post("/api/anggota").send({
      nama: "Budi", email: "budi@example.com"
    });

    expect(duplicate.status).toBe(409);
    expect(failure.status).toBe(500);
  });

  test("validates and deletes a member", async () => {
    const invalid = await request(app).delete("/api/anggota/abc");
    mockPool.query.mockResolvedValueOnce({ rowCount: 1 });
    const deleted = await request(app).delete("/api/anggota/1");

    expect(invalid.status).toBe(400);
    expect(deleted.status).toBe(200);
  });

  test("handles missing and failed member deletion", async () => {
    mockPool.query.mockResolvedValueOnce({ rowCount: 0 });
    const missing = await request(app).delete("/api/anggota/99");
    mockPool.query.mockRejectedValueOnce(new Error("database"));
    const failure = await request(app).delete("/api/anggota/1");

    expect(missing.status).toBe(404);
    expect(failure.status).toBe(500);
  });
});

describe("loans", () => {
  test("lists loans", async () => {
    mockPool.query.mockResolvedValue({ rows: [] });

    const res = await request(app).get("/api/peminjaman");

    expect(res.status).toBe(200);
  });

  test("handles loan loading errors", async () => {
    mockPool.query.mockRejectedValue(new Error("database"));

    const res = await request(app).get("/api/peminjaman");

    expect(res.status).toBe(500);
  });

  test("rejects invalid loan IDs", async () => {
    const res = await request(app).post("/api/peminjaman").send({
      buku_id: "abc",
      anggota_id: 1
    });

    expect(res.status).toBe(400);
  });

  test("creates a loan", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 12 }] })
        .mockResolvedValueOnce({})
    };
    mockPool.connect.mockResolvedValue({
      ...client,
      release: jest.fn()
    });

    const res = await request(app).post("/api/peminjaman").send({
      buku_id: 1,
      anggota_id: 2
    });

    expect(res.status).toBe(201);
  });

  test("rejects an unavailable book", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({})
    };
    mockPool.connect.mockResolvedValue({
      ...client,
      release: jest.fn()
    });

    const res = await request(app).post("/api/peminjaman").send({
      buku_id: 1,
      anggota_id: 2
    });

    expect(res.status).toBe(409);
  });

  test("handles loan transaction errors", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ code: "23503" })
        .mockResolvedValueOnce({})
    };
    mockPool.connect.mockResolvedValue({
      ...client,
      release: jest.fn()
    });

    const res = await request(app).post("/api/peminjaman").send({
      buku_id: 1,
      anggota_id: 99
    });

    expect(res.status).toBe(400);
  });

  test("handles generic loan transaction failures", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("database"))
        .mockResolvedValueOnce({})
    };
    mockPool.connect.mockResolvedValue({
      ...client,
      release: jest.fn()
    });

    const res = await request(app).post("/api/peminjaman").send({
      buku_id: 1,
      anggota_id: 2
    });

    expect(res.status).toBe(500);
  });

  test("records a return", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ buku_id: 1 }] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
    };
    mockPool.connect.mockResolvedValue({
      ...client,
      release: jest.fn()
    });

    const res = await request(app).put("/api/peminjaman/1/kembali");

    expect(res.status).toBe(200);
  });

  test("rejects invalid loan IDs and already returned loans", async () => {
    const invalid = await request(app).put("/api/peminjaman/abc/kembali");
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rowCount: 0 })
        .mockResolvedValueOnce({})
    };
    mockPool.connect.mockResolvedValue({
      ...client,
      release: jest.fn()
    });
    const missing = await request(app).put("/api/peminjaman/99/kembali");

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });

  test("handles return transaction errors", async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("database"))
        .mockResolvedValueOnce({})
    };
    mockPool.connect.mockResolvedValue({
      ...client,
      release: jest.fn()
    });

    const res = await request(app).put("/api/peminjaman/1/kembali");

    expect(res.status).toBe(500);
  });
});
