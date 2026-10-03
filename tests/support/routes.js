// Routes requests the way netlify.toml's [[redirects]] say they should be
// routed: rules read from the real netlify.toml, applied in file order,
// first match wins. This is a re-implementation of the subset of Netlify's
// redirect matching the file uses (literal paths, `:placeholder` segments,
// trailing `*` splats) -- it is not Netlify's own engine.
const fs = require('fs');
const path = require('path');
const { parse } = require('smol-toml');

const ROOT = path.resolve(__dirname, '..', '..');

function escapeRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function compile(from) {
  const pattern = from
    .split('/')
    .map((seg) => {
      if (seg === '*') return '(.*)';
      if (seg.startsWith(':')) return '([^/]+)';
      return escapeRegex(seg);
    })
    .join('/');
  return new RegExp(`^${pattern}$`);
}

function loadRedirects() {
  const config = parse(fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8'));
  return (config.redirects || []).map((r) => ({ ...r, regex: compile(r.from) }));
}

// -> { type: 'function', name } | { type: 'redirect', status, location } | null
function resolve(redirects, pathname) {
  const direct = pathname.match(/^\/\.netlify\/functions\/([^/]+)/);
  if (direct) return { type: 'function', name: direct[1] };
  for (const rule of redirects) {
    const m = pathname.match(rule.regex);
    if (!m) continue;
    const fn = rule.to.match(/^\/\.netlify\/functions\/([^/]+)$/);
    if (fn && (rule.status === 200 || rule.status === undefined)) return { type: 'function', name: fn[1] };
    if (rule.status === 301 || rule.status === 302) {
      // Substitute :placeholders from the matched source path.
      const names = (rule.from.match(/:[a-z]+/gi) || []).map((n) => n.slice(1));
      let location = rule.to;
      names.forEach((name, i) => {
        location = location.replace(`:${name}`, m[i + 1]);
      });
      return { type: 'redirect', status: rule.status, location };
    }
  }
  return null;
}

module.exports = { loadRedirects, resolve };
