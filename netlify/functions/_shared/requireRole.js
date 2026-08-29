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

// Same shape as requireRole, but passes if the caller has ANY of the listed
// roles rather than one specific one — for endpoints legitimately shared by
// more than one role (e.g. recipes-list.js: both translators, who pick a
// recipe to edit, and approvers, who pick one to publish/unpublish, need the
// listing). Endpoints that are genuinely role-specific (editing, approving,
// publishing) should keep using requireRole with the one role that's
// actually allowed to perform that action.
function requireAnyRole(allowedRoles, context) {
  const user = context.clientContext && context.clientContext.user;
  const roles = getRoles(user);
  if (!user) return { ok: false, status: 401, error: 'Not authenticated.' };
  if (!allowedRoles.some((role) => roles.includes(role))) return { ok: false, status: 403, error: 'Unauthorized.' };
  return { ok: true, user, roles };
}

module.exports = { requireRole, requireAnyRole, getRoles };
