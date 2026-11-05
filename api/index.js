'use strict';

/**
 * ============================================================================
 *  Al-Firdous API — /api  (Vercel serverless function, also used locally)
 * ============================================================================
 *
 *  GET  /api?secret=...                    -> { ok, rev, staff, expenses, kafala, fath }
 *  POST /api  { secret, action, type, ... } -> { ok, rev, ... }
 *
 *  action: add | update | delete | replace
 *  type:   staff | expenses | kafala | fath
 *
 *  CORS is open so the static page on GitHub Pages can call it directly.
 * ============================================================================
 */

const { readAll, applyAction, checkSecret, HttpError } = require('../server/lib');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Api-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function parseBody(body) {
  if (body == null) return {};
  if (typeof body === 'string') {
    const text = body.trim();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new HttpError(400, 'invalid json body');
    }
  }
  return body;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/api', 'http://localhost');
    const query = Object.fromEntries(url.searchParams.entries());

    if (req.method === 'GET') {
      checkSecret(query.secret || req.headers['x-api-secret']);
      const data = await readAll();
      sendJson(res, 200, data);
      return;
    }

    if (req.method === 'POST') {
      const body = parseBody(req.body);
      checkSecret(body.secret || query.secret || req.headers['x-api-secret']);
      const result = await applyAction(body);
      sendJson(res, 200, result);
      return;
    }

    throw new HttpError(405, 'method not allowed');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'server error';
    // eslint-disable-next-line no-console
    console.error('[api]', req.method, err && err.message ? err.message : err);
    sendJson(res, status, {
      ok: false,
      error: message,
      detail: status === 500 ? String((err && err.message) || err).slice(0, 200) : undefined
    });
  }
};
