import { getDatabase, toPublicProduct } from '../../server/db.js';
import { handleError, methodNotAllowed, readBody, send, validateOrigin } from '../../server/http.js';
import { requireAdmin } from '../../server/auth.js';
import { validateProduct } from '../../server/validation.js';

export default async function handler(req, res) {
  try {
    validateOrigin(req);
    if (!await requireAdmin(req, res)) return;
    const id = String(req.query.id || '');
    if (!id || id.length > 80) return send(res, 400, { error: 'Invalid product ID.' });
    const products = (await getDatabase()).collection('products');
    if (req.method === 'PATCH') {
      const current = await products.findOne({ id });
      if (!current) return send(res, 404, { error: 'Product not found.' });
      const update = validateProduct({ ...current, ...readBody(req) }, id);
      await products.updateOne({ id }, { $set: update });
      return send(res, 200, { product: toPublicProduct(update) });
    }
    if (req.method === 'DELETE') {
      const result = await products.updateOne({ id }, { $set: { active: false, updatedAt: new Date() } });
      if (!result.matchedCount) return send(res, 404, { error: 'Product not found.' });
      return send(res, 200, { ok: true });
    }
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  } catch (error) {
    return handleError(res, error);
  }
}
