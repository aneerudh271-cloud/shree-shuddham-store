import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getDatabase, toPublicOrder } from '../../server/db.js';
import { requireAdmin } from '../../server/auth.js';
import { handleError, methodNotAllowed, readBody, requireString, send, validateOrigin } from '../../server/http.js';
import { deliverySlots, validateCustomer, validateOrderItems } from '../../server/validation.js';
import { enforceRateLimit } from '../../server/rate-limit.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (!await requireAdmin(req, res)) return;
      const db = await getDatabase();
      const query = {};
      if (req.query.cursor) {
        try {
          const cursor = JSON.parse(Buffer.from(String(req.query.cursor), 'base64url').toString('utf8'));
          const createdAt = new Date(cursor.createdAt);
          if (!ObjectId.isValid(cursor.id) || Number.isNaN(createdAt.valueOf())) throw new Error('Invalid cursor.');
          query.$or = [
            { createdAt: { $lt: createdAt } },
            { createdAt, _id: { $lt: new ObjectId(cursor.id) } }
          ];
        } catch {
          return send(res, 400, { error: 'Invalid order page cursor.' });
        }
      }
      const rows = await db.collection('orders').find(query).sort({ createdAt: -1, _id: -1 }).limit(101).toArray();
      const hasMore = rows.length > 100;
      if (hasMore) rows.pop();
      const last = rows.at(-1);
      const nextCursor = hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: String(last._id) })).toString('base64url')
        : null;
      const summary = await db.collection('orders').aggregate([
        {
          $group: {
            _id: null,
            pending: {
              $sum: {
                $cond: [{ $in: ['$status', ['Awaiting payment initiation', 'Awaiting admin review']] }, 1, 0]
              }
            },
            demoOrderValue: {
              $sum: {
                $cond: [{
                  $and: [
                    { $ne: ['$status', 'Declined'] },
                    { $not: [{ $in: ['$status', ['Awaiting payment initiation', 'Awaiting admin review']] }] }
                  ]
                }, '$total', 0]
              }
            }
          }
        }
      ]).next();
      return send(res, 200, {
        orders: rows.map(toPublicOrder),
        nextCursor,
        summary: { pending: summary?.pending || 0, demoOrderValue: summary?.demoOrderValue || 0 }
      });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);
    validateOrigin(req);
    const body = readBody(req);
    const db = await getDatabase();
    await enforceRateLimit(db, req, 'create-order', 10, 10 * 60 * 1000);
    const customer = validateCustomer(body.customer);
    const serviceArea = await db.collection('pincodes').findOne({ pin: customer.pin, active: true }, { projection: { _id: 1 } });
    if (!serviceArea) return send(res, 400, { error: 'We do not currently deliver to that PIN code.' });
    if (!deliverySlots.includes(customer.deliverySlot)) {
      return send(res, 400, { error: 'Choose one of the available delivery slots.' });
    }
    if (!['Tomorrow', 'Day after tomorrow', 'Choose a date with admin'].includes(customer.deliveryDay)) {
      const chosenDate = new Date(`${customer.deliveryDay}T00:00:00`);
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customer.deliveryDay) || Number.isNaN(chosenDate.valueOf()) || chosenDate < tomorrow) {
        return send(res, 400, { error: 'Choose a supported delivery date.' });
      }
    }
    const requested = validateOrderItems(body.items);
    const productDocs = await db.collection('products')
      .find({ id: { $in: requested.map((item) => item.productId) }, active: true }).toArray();
    const productMap = new Map(productDocs.map((product) => [product.id, product]));
    if (productMap.size !== requested.length) return send(res, 409, { error: 'One or more selected products are unavailable. Refresh your basket.' });
    const items = requested.map(({ productId, quantity }) => {
      const product = productMap.get(productId);
      return {
        id: product.id,
        name: product.name,
        category: product.category,
        unit: product.unit,
        price: product.price,
        quantity,
        image: product.image,
        alt: product.alt
      };
    });
    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
    const delivery = subtotal >= 499 ? 0 : 40;
    let coupon = null;
    const couponCode = requireString(body.couponCode || '', 'Coupon code', 32, false).toUpperCase();
    if (couponCode) {
      coupon = await db.collection('coupons').findOne({ code: couponCode, active: true });
      if (!coupon) return send(res, 400, { error: 'That coupon code is not active or valid.' });
    }
    const discount = coupon
      ? Math.min(subtotal, coupon.type === 'percent' ? Math.floor(subtotal * coupon.value / 100) : coupon.value)
      : 0;
    const now = new Date();
    const order = {
      id: `SS-${randomUUID().replaceAll('-', '').toUpperCase()}`,
      customer, items, subtotal, delivery, discount, total: subtotal + delivery - discount,
      coupon: coupon?.code || '',
      deliveryDate: customer.deliveryDay,
      deliverySlot: customer.deliverySlot,
      status: 'Awaiting payment initiation',
      paymentStatus: 'Not initiated',
      paymentMethod: '',
      deliveryAgent: '',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      updatedAt: now
    };
    await db.collection('orders').insertOne(order);
    return send(res, 201, { order: toPublicOrder(order) });
  } catch (error) {
    return handleError(res, error);
  }
}
