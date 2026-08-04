function getRoles(user) {
  return (user && (
    (user.app_metadata && user.app_metadata.authorization && user.app_metadata.authorization.roles) ||
    (user.app_metadata && user.app_metadata.roles)
  )) || [];
}

function requireRole(role, context) {
  const user = context.clientContext && context.clientContext.user;
  const roles = getRoles(user);
  if (!user) return { ok: false, status: 401, error: 'Not authenticated.' };
  if (!roles.includes(role)) return { ok: false, status: 403, error: 'Unauthorized.' };
  return { ok: true, user, roles };
}

module.exports = { requireRole, getRoles };
