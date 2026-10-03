import { getDatabase, toPublicOrder } from '../../server/db.js';
import { requireAdmin } from '../../server/auth.js';
import { handleError, methodNotAllowed, readBody, requireString, send, validateOrigin } from '../../server/http.js';

const deliveryStatuses = ['Accepted', 'Preparing', 'Packed', 'Out for Delivery', 'Delivered'];

export default async function handler(req, res) {
  try {
    validateOrigin(req);
    if (!await requireAdmin(req, res)) return;
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
    const id = String(req.query.id || '');
    const body = readBody(req);
    const orders = (await getDatabase()).collection('orders');
    const order = await orders.findOne({ id });
    if (!order) return send(res, 404, { error: 'Order not found.' });
    if (order.status === 'Awaiting payment initiation') {
      return send(res, 409, { error: 'This order is waiting for payment initiation and cannot be reviewed yet.' });
    }
    if (order.status === 'Awaiting admin review') {
      if (!['Accepted', 'Declined'].includes(body.status)) return send(res, 400, { error: 'Choose accept or decline for a pending order.' });
      const result = await orders.updateOne(
        { id, status: order.status },
        { $set: { status: body.status, updatedAt: new Date() } }
      );
      if (!result.modifiedCount) return send(res, 409, { error: 'This order has already been updated.' });
      return send(res, 200, { order: toPublicOrder({ ...order, status: body.status, updatedAt: new Date() }) });
    }
    if (order.status === 'Declined') return send(res, 409, { error: 'Declined orders cannot be changed.' });
    const status = requireString(body.status, 'Delivery status', 32);
    if (!deliveryStatuses.includes(status)) return send(res, 400, { error: 'Choose a valid delivery status.' });
    const deliveryAgent = requireString(body.deliveryAgent || '', 'Delivery agent', 80, false);
    const result = await orders.updateOne(
      { id, status: order.status },
      { $set: { status, deliveryAgent, updatedAt: new Date() } }
    );
    if (!result.modifiedCount) return send(res, 409, { error: 'This order has already been updated.' });
    return send(res, 200, { order: toPublicOrder({ ...order, status, deliveryAgent, updatedAt: new Date() }) });
  } catch (error) {
    return handleError(res, error);
  }
}
