import { changeAdminCredentials, requireAdmin } from '../../server/auth.js';
import { handleError, methodNotAllowed, readBody, requireString, send } from '../../server/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
    if (!await requireAdmin(req, res)) return;
    const body = readBody(req);
    const username = requireString(body.username, 'Admin ID', 80);
    const currentPassword = requireString(body.currentPassword, 'Current password', 256);
    const password = requireString(body.password || '', 'New password', 256, false);
    if (username.length < 3) return send(res, 400, { error: 'Admin ID must be at least 3 characters.' });
    if (password && password.length < 12) return send(res, 400, { error: 'New password must be at least 12 characters.' });
    return await changeAdminCredentials(req, res, username, password, currentPassword);
  } catch (error) {
    return handleError(res, error);
  }
}
