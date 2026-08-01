function getToken() {
  const user = window.netlifyIdentity && window.netlifyIdentity.currentUser();
  return user && user.token && user.token.access_token;
}

async function apiGet(path) {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((body && body.error) || res.statusText);
  }
  return body;
}

export { apiGet };
