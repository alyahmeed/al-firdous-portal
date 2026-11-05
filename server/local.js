'use strict';

/**
 * Local development server — serves the portal + the same /api handler.
 *
 *   npm install
 *   npm start            ->  http://localhost:3000
 *
 * It talks to the local MongoDB by default (mongodb://127.0.0.1:27017/al_firdous).
 * To use Atlas instead, set MONGODB_URI before starting.
 */

const path = require('path');
const express = require('express');
const handler = require('../api/index.js');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, '..');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use(express.text({ limit: '8mb', type: 'text/plain' }));

app.all('/api', (req, res) => handler(req, res));
app.all('/api/*', (req, res) => handler(req, res));

app.use(
  express.static(ROOT, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (/index\.html$/.test(filePath)) res.setHeader('Cache-Control', 'no-store');
    }
  })
);

app.use((req, res) => {
  res.status(404).send('Not found');
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  Al-Firdous portal (local)');
  console.log('  ---------------------------------------');
  console.log('  Page : http://localhost:' + PORT + '/#/women');
  console.log('  API  : http://localhost:' + PORT + '/api');
  console.log('  Mongo: ' + (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/al_firdous'));
  console.log('');
});
