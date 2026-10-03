import { createServer } from 'node:http';
import health from './api/health.js';
import adminCredentials from './api/admin/credentials.js';
import adminLogin from './api/admin/login.js';
import adminLogout from './api/admin/logout.js';
import adminSession from './api/admin/session.js';
import couponByCode from './api/coupons/[code].js';
import coupons from './api/coupons/index.js';
import orderById from './api/orders/[id].js';
import demoPayment from './api/orders/[id]/demo-payment.js';
import orders from './api/orders/index.js';
import pincodeByPin from './api/pincodes/[pin].js';
import pincodes from './api/pincodes/index.js';
import productById from './api/products/[id].js';
import products from './api/products/index.js';
import { handleError, send } from './server/http.js';

const routes = new Map([
  ['/api/health', health],
  ['/api/admin/credentials', adminCredentials],
  ['/api/admin/login', adminLogin],
  ['/api/admin/logout', adminLogout],
  ['/api/admin/session', adminSession],
  ['/api/coupons', coupons],
  ['/api/orders', orders],
  ['/api/pincodes', pincodes],
  ['/api/products', products]
]);

const maxBodyBytes = 1024 * 1024;

async function parseBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const contentType = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
  if (!contentType) return undefined;
  if (contentType !== 'application/json') {
    const error = new Error('Content-Type must be application/json.');
    error.status = 415;
    throw error;
  }

  const chunks = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk);
  }
  if (tooLarge) {
    const error = new Error('Request body is too large.');
    error.status = 413;
    throw error;
  }
  if (!size) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must contain valid JSON.');
    error.status = 400;
    throw error;
  }
}

function resolveRoute(pathname) {
  const exact = routes.get(pathname);
  if (exact) return { handler: exact, params: {} };

  let parts;
  try {
    parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    const error = new Error('Invalid URL path.');
    error.status = 400;
    throw error;
  }
  if (parts[0] !== 'api') return null;
  if (parts.length === 3 && parts[1] === 'products') return { handler: productById, params: { id: parts[2] } };
  if (parts.length === 3 && parts[1] === 'coupons') return { handler: couponByCode, params: { code: parts[2] } };
  if (parts.length === 3 && parts[1] === 'pincodes') return { handler: pincodeByPin, params: { pin: parts[2] } };
  if (parts.length === 3 && parts[1] === 'orders') return { handler: orderById, params: { id: parts[2] } };
  if (parts.length === 4 && parts[1] === 'orders' && parts[3] === 'demo-payment') {
    return { handler: demoPayment, params: { id: parts[2] } };
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const route = resolveRoute(url.pathname);
    if (!route) return send(res, 404, { error: 'Not found.' });
    req.query = { ...Object.fromEntries(url.searchParams), ...route.params };
    req.body = await parseBody(req);
    await route.handler(req, res);
  } catch (error) {
    handleError(res, error);
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`Shree Shuddham API listening on port ${port}.`);
});
