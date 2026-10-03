import { getDatabase, toPublicOrder } from '../../../server/db.js';
import { handleError, methodNotAllowed, readBody, requireString, send, validateOrigin } from '../../../server/http.js';

const demoMethods = ['UPI (simulated)', 'Card (simulated)', 'Net banking (simulated)', 'Wallet (simulated)'];

export default async function handler(req, res) {
  try {
    validateOrigin(req);
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
    const id = String(req.query.id || '');
    const body = readBody(req);
    const paymentMethod = requireString(body.paymentMethod, 'Payment method', 32);
    if (!demoMethods.includes(paymentMethod)) return send(res, 400, { error: 'Choose a supported demo payment method.' });
    const orders = (await getDatabase()).collection('orders');
    const order = await orders.findOne({ id });
    if (!order) return send(res, 404, { error: 'Order not found.' });
    if (order.paymentStatus === 'Demo payment initiated - no charge') {
      return send(res, 200, { order: toPublicOrder(order) });
    }
    if (order.expiresAt && order.expiresAt <= new Date()) {
      return send(res, 410, { error: 'This checkout has expired. Please start a new order.' });
    }
    if (order.status !== 'Awaiting payment initiation') {
      return send(res, 409, { error: 'This order is not awaiting payment initiation.' });
    }
    const update = {
      status: 'Awaiting admin review',
      paymentStatus: 'Demo payment initiated - no charge',
      paymentMethod,
      paymentInitiatedAt: new Date(),
      updatedAt: new Date()
    };
    const result = await orders.updateOne(
      { id, status: 'Awaiting payment initiation', expiresAt: { $gt: new Date() } },
      { $set: update, $unset: { expiresAt: '' } }
    );
    if (!result.modifiedCount) return send(res, 409, { error: 'This order has already moved to another state.' });
    const { expiresAt, ...paymentOrder } = order;
    return send(res, 200, { order: toPublicOrder({ ...paymentOrder, ...update }) });
  } catch (error) {
    return handleError(res, error);
  }
}
