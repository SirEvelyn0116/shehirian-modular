// user.jwt() (not user.token.access_token) — it auto-refreshes the token
// via the refresh_token when the current one is expired or expiring within
// 60s, instead of handing back a possibly-stale access token as-is.
async function getToken() {
  const user = window.netlifyIdentity && window.netlifyIdentity.currentUser();
  return user ? user.jwt() : null;
}

async function apiRequest(path, options = {}) {
  const token = await getToken();
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.error) || res.statusText);
  }
  return body;
}

function apiGet(path) {
  return apiRequest(path);
}

function apiPost(path, body) {
  return apiRequest(path, { method: 'POST', body });
}

// Mirrors admin.js's / welcome.html's getRoles — same Identity role shape,
// duplicated rather than shared since those are plain scripts and this is
// an ES module with no bundling relationship to them.
function getRoles(user) {
  return (user && (
    (user.app_metadata && user.app_metadata.authorization && user.app_metadata.authorization.roles) ||
    (user.app_metadata && user.app_metadata.roles)
  )) || [];
}

export { apiGet, apiPost, getRoles };
