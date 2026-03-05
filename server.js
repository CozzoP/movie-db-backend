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
    CREATE TABLE IF NOT EXISTS auto (
      id SERIAL PRIMARY KEY,
      marca VARCHAR(100) NOT NULL,
      modello VARCHAR(100) NOT NULL
    )
  `);

  // Inserisci dati iniziali se la tabella è vuota
  const { rowCount } = await pool.query('SELECT 1 FROM auto LIMIT 1');
  if (rowCount === 0) {
    await pool.query(`
      INSERT INTO auto (marca, modello) VALUES
        ('Toyota', 'Corolla'),
        ('Ford', 'Mustang'),
        ('Volkswagen', 'Golf')
    `);
    console.log('Dati iniziali inseriti.');
  }

  console.log('Database pronto.');
}

// GET /api/auto - ottieni tutte le auto
app.get('/api/auto', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM auto ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// GET /api/auto/cerca?q=... - cerca per marca o modello
app.get('/api/auto/cerca', async (req, res) => {
  const { q } = req.query;
  try {
    const result = await pool.query(
      'SELECT * FROM auto WHERE LOWER(marca) LIKE $1 OR LOWER(modello) LIKE $1 ORDER BY id',
      [`%${q?.toLowerCase()}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// POST /api/auto - aggiungi un'auto
app.post('/api/auto', async (req, res) => {
  const { marca, modello } = req.body;
  if (!marca || !modello) return res.status(400).json({ errore: 'marca e modello sono obbligatori' });
  try {
    const result = await pool.query(
      'INSERT INTO auto (marca, modello) VALUES ($1, $2) RETURNING *',
      [marca, modello]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// DELETE /api/auto/:id - rimuovi un'auto
app.delete('/api/auto/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM auto WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) return res.status(404).json({ errore: 'Auto non trovata' });
    res.json({ messaggio: 'Auto eliminata', auto: result.rows[0] });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`Server avviato sulla porta ${PORT}`));
});
