import { defaultProducts } from '../../server/defaults.js';
import { getDatabase, toPublicProduct } from '../../server/db.js';
import { handleError, methodNotAllowed, readBody, send, validateOrigin } from '../../server/http.js';
import { requireAdmin } from '../../server/auth.js';
import { validateProduct } from '../../server/validation.js';
import { randomUUID } from 'node:crypto';

async function seedProducts(db) {
  const products = db.collection('products');
  if (await products.estimatedDocumentCount()) return;
  try {
    await products.insertMany(defaultProducts);
  } catch (error) {
    if (error.code !== 11000) throw error;
  }
}

export default async function handler(req, res) {
  try {
    const db = await getDatabase();
    await seedProducts(db);
    const products = db.collection('products');
    if (req.method === 'GET') {
      const includeInactive = req.query.includeInactive === 'true';
      if (includeInactive && !await requireAdmin(req, res)) return;
      const query = includeInactive ? {} : { active: true };
      const rows = await products.find(query, { projection: { _id: 0 } }).sort({ category: 1, name: 1 }).toArray();
      return send(res, 200, { products: rows.map(toPublicProduct) });
    }
    if (req.method === 'POST') {
      validateOrigin(req);
      if (!await requireAdmin(req, res)) return;
      const body = readBody(req);
      const product = validateProduct(body, randomUUID());
      await products.insertOne(product);
      return send(res, 201, { product: toPublicProduct(product) });
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (error) {
    return handleError(res, error);
  }
}
