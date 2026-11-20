CREATE TABLE IF NOT EXISTS buku (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL,
  penulis TEXT NOT NULL,
  tahun INT,
  kategori TEXT NOT NULL DEFAULT 'Umum',
  stok INT NOT NULL DEFAULT 1 CHECK (stok >= 0),
  UNIQUE (judul, penulis)
);

CREATE TABLE IF NOT EXISTS anggota (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS peminjaman (
  id SERIAL PRIMARY KEY,
  buku_id INT NOT NULL REFERENCES buku(id) ON DELETE CASCADE,
  anggota_id INT NOT NULL REFERENCES anggota(id) ON DELETE CASCADE,
  tgl_pinjam DATE NOT NULL DEFAULT CURRENT_DATE,
  tgl_kembali DATE
);

INSERT INTO buku (judul, penulis, tahun, kategori, stok) VALUES
  ('Laskar Pelangi', 'Andrea Hirata', 2005, 'Fiksi', 3),
  ('Bumi Manusia', 'Pramoedya Ananta Toer', 1980, 'Fiksi', 3),
  ('Negeri 5 Menara', 'Ahmad Fuadi', 2009, 'Fiksi', 2),
  ('Filosofi Teras', 'Henry Manampiring', 2018, 'Pengembangan Diri', 3),
  ('Atomic Habits', 'James Clear', 2018, 'Pengembangan Diri', 5),
  ('Clean Code', 'Robert C. Martin', 2008, 'Teknologi', 1),
  ('The Pragmatic Programmer', 'Andrew Hunt dan David Thomas', 1999, 'Teknologi', 2),
  ('Sapiens', 'Yuval Noah Harari', 2011, 'Sejarah', 3),
  ('Cantik Itu Luka', 'Eka Kurniawan', 2002, 'Fiksi', 0),
  ('Dunia Sophie', 'Jostein Gaarder', 1991, 'Filsafat', 3)
ON CONFLICT (judul, penulis) DO NOTHING;

INSERT INTO anggota (nama, email) VALUES
  ('Budi Santoso', 'budi@example.com'),
  ('Sari Wulandari', 'sari@example.com'),
  ('Made Wirawan', 'made@example.com'),
  ('Ayu Lestari', 'ayu@example.com'),
  ('Kadek Putra', 'kadek@example.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO peminjaman (buku_id, anggota_id, tgl_pinjam, tgl_kembali)
SELECT b.id, a.id, v.tgl_pinjam::date, v.tgl_kembali::date
FROM (VALUES
  ('Laskar Pelangi', 'budi@example.com', '2026-11-15', NULL),
  ('Clean Code', 'sari@example.com', '2026-11-17', NULL),
  ('Cantik Itu Luka', 'made@example.com', '2026-11-18', NULL),
  ('Atomic Habits', 'ayu@example.com', '2026-11-02', '2026-11-09'),
  ('Sapiens', 'kadek@example.com', '2026-11-05', '2026-11-12')
) AS v(judul, email, tgl_pinjam, tgl_kembali)
JOIN buku b ON b.judul = v.judul
JOIN anggota a ON a.email = v.email
WHERE NOT EXISTS (SELECT 1 FROM peminjaman);