const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Railway fornisce automaticamente DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Inizializza la tabella al primo avvio
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS film (
      id SERIAL PRIMARY KEY,
      titolo VARCHAR(255) NOT NULL,
      anno INTEGER,
      genere VARCHAR(100),
      voto NUMERIC(3,1)
    )
  `);

  // Inserisci dati iniziali se la tabella è vuota
  const { rowCount } = await pool.query('SELECT 1 FROM film LIMIT 1');
  if (rowCount === 0) {
    await pool.query(`
      INSERT INTO film (titolo, anno, genere, voto) VALUES
        ('Inception', 2010, 'Fantascienza', 9),
        ('Il Padrino', 1972, 'Drammatico', 10),
        ('Interstellar', 2014, 'Fantascienza', 8.5)
    `);
    console.log('Dati iniziali inseriti.');
  }

  console.log('Database pronto.');
}

// GET /api/film - ottieni tutti i film
app.get('/api/film', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM film ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// GET /api/film/cerca?q=... - cerca per titolo o genere
app.get('/api/film/cerca', async (req, res) => {
  const { q } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM film WHERE LOWER(titolo) LIKE $1 OR LOWER(genere) LIKE $1 ORDER BY id',
      [`%${q?.toLowerCase()}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// POST /api/film - aggiungi un film
app.post('/api/film', async (req, res) => {
  const { titolo, anno, genere, voto } = req.body;
  if (!titolo) return res.status(400).json({ errore: 'il titolo è obbligatorio' });
  if (voto && (voto < 1 || voto > 10)) return res.status(400).json({ errore: 'il voto deve essere tra 1 e 10' });
  try {
    const result = await pool.query(
      'INSERT INTO film (titolo, anno, genere, voto) VALUES ($1, $2, $3, $4) RETURNING *',
      [titolo, anno || null, genere || null, voto || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// DELETE /api/film/:id - rimuovi un film
app.delete('/api/film/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM film WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ errore: 'Film non trovato' });
    res.json({ messaggio: 'Film eliminato', film: result.rows[0] });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`Server avviato sulla porta ${PORT}`));
});
