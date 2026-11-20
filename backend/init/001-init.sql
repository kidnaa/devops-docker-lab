CREATE TABLE IF NOT EXISTS app_messages (
 id SERIAL PRIMARY KEY,
 message TEXT NOT NULL
);
INSERT INTO app_messages (message)
VALUES ('Halo dari PostgreSQL')
ON CONFLICT DO NOTHING;