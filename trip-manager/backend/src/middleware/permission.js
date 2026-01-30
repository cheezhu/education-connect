const resolveUserRecord = (req) => {
  if (req.userRecord) {
    return req.userRecord;
  }

  const username = req.user || req.auth?.user;
  if (!username || !req.db) {
    return null;
  }

  const user = req.db
    .prepare('SELECT id, username, display_name, role FROM users WHERE username = ?')
    .get(username);

  if (user) {
    req.userRecord = user;
    req.userRole = user.role;
  }

  return user;
};

const resolveRole = (req) => {
  if (req.userRole) {
    return req.userRole;
  }
  const user = resolveUserRecord(req);
  return user?.role || null;
};

const deny = (res) => res.status(403).json({ error: '权限不足' });

const requireRole = (allowedRoles = []) => (req, res, next) => {
  const role = resolveRole(req);
  if (!role) {
    return deny(res);
  }
  if (role === 'admin') {
    return next();
  }
  if (allowedRoles.includes(role)) {
    return next();
  }
  return deny(res);
};

const requireAccess = ({ read = [], write = [] } = {}) => (req, res, next) => {
  const role = resolveRole(req);
  if (!role) {
    return deny(res);
  }
  if (role === 'admin') {
    return next();
  }

  const method = req.method.toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const allowed = isRead ? read : write;

  if (allowed.includes(role)) {
    return next();
  }
  return deny(res);
};

module.exports = {
  resolveUserRecord,
  requireRole,
  requireAccess
};
