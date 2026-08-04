// user.jwt() (not user.token.access_token) — it auto-refreshes the token
// via the refresh_token when the current one is expired or expiring within
// 60s, instead of handing back a possibly-stale access token as-is.
async function getToken() {
  const user = window.netlifyIdentity && window.netlifyIdentity.currentUser();
  return user ? user.jwt() : null;
}

async function apiGet(path) {
  const token = await getToken();
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.error) || res.statusText);
  }
  return body;
}

export { apiGet };
