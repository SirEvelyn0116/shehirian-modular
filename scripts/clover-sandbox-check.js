/**
 * Clover sandbox connection check.
 *
 * Verifies that the Clover credentials in .env can actually reach the
 * Clover REST API, and explains any failure in plain English. Read-only:
 * it only GETs the merchant, a few inventory items and a few orders.
 * Never prints the API token.
 *
 * Setup — add to .env (git-ignored):
 *   CLOVER_API_TOKEN=<token from the sandbox test merchant: Account & Setup > API Tokens>
 *   CLOVER_MERCHANT_ID=<13-character merchant ID of the sandbox test merchant>
 *   # optional; defaults to the North America sandbox API:
 *   # CLOVER_API_BASE=https://apisandbox.dev.clover.com
 *
 * Run:  node scripts/clover-sandbox-check.js
 */
require('dotenv').config();

const BASE = (process.env.CLOVER_API_BASE || 'https://apisandbox.dev.clover.com').replace(/\/+$/, '');
const TOKEN = (process.env.CLOVER_API_TOKEN || '').trim();
const MID = (process.env.CLOVER_MERCHANT_ID || '').trim();

function bail(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1); }

console.log('Clover sandbox check');
console.log('  API base:    ' + BASE);
console.log('  Merchant ID: ' + (MID || '(missing)'));
console.log('  API token:   ' + (TOKEN ? 'set' : '(missing)'));

if (!TOKEN || !MID) bail('CLOVER_API_TOKEN and CLOVER_MERCHANT_ID must both be set in .env (see the header of this file).');
if (/\/\/(www\.)?sandbox\.dev\.clover\.com/.test(BASE)) {
  bail('CLOVER_API_BASE points at sandbox.dev.clover.com — that is the sandbox *dashboard* website, not the API.\n  Use https://apisandbox.dev.clover.com (or remove CLOVER_API_BASE to use the default).');
}
if (!/^[A-Z0-9]{13}$/.test(MID)) {
  console.warn('  ⚠ Merchant IDs are usually 13 uppercase letters/digits — double-check this one.');
}

function explain(status, bodyText) {
  if (/^\s*</.test(bodyText)) return 'Got a web page instead of JSON — the API base URL is wrong (dashboard vs API host).';
  switch (status) {
    case 401: return 'Unauthorized — the token is invalid, revoked, or from a different environment (a production token will not work on sandbox, and vice versa).';
    case 403: return 'Forbidden — the token works but lacks permission for this call. Edit the token and enable the matching read permission (Merchant, Inventory, Orders).';
    case 404: return 'Not found — the merchant ID is wrong, or it belongs to a different environment than the token.';
    case 429: return 'Rate limited — wait a minute and try again.';
    default:  return 'Unexpected response.';
  }
}

async function get(path, label) {
  let res, text;
  try {
    res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/json' } });
    text = await res.text();
  } catch (e) {
    console.log(`\n✗ ${label}: could not connect (${e.cause?.code || e.message}). Check your internet connection / VPN / firewall.`);
    return null;
  }
  if (!res.ok || /^\s*</.test(text)) {
    console.log(`\n✗ ${label}: HTTP ${res.status}. ${explain(res.status, text)}`);
    const snippet = text.replace(/\s+/g, ' ').slice(0, 200);
    if (snippet && !/^\s*</.test(text)) console.log('  Clover said: ' + snippet);
    return null;
  }
  try { return JSON.parse(text); } catch { console.log(`\n✗ ${label}: response was not JSON.`); return null; }
}

(async () => {
  const merchant = await get(`/v3/merchants/${MID}?expand=address`, 'Merchant');
  if (!merchant) process.exit(1);
  const country = (merchant.address && merchant.address.country) || 'unknown';
  console.log(`\n✓ Connected — merchant: "${merchant.name || '(unnamed)'}", country: ${country}`);
  if (country !== 'CA') console.log('  ⚠ This is not the Canadian test merchant — use the CA one so the data matches their real storefront.');

  const items = await get(`/v3/merchants/${MID}/items?limit=5`, 'Inventory items');
  if (items) {
    const els = items.elements || [];
    console.log(`✓ Inventory readable — showing ${els.length} item(s)` + (els.length ? ':' : ' (the sandbox merchant has no items yet)'));
    els.forEach(i => console.log(`    • ${i.name}  $${((i.price || 0) / 100).toFixed(2)}`));
  }

  const orders = await get(`/v3/merchants/${MID}/orders?limit=5&orderBy=createdTime%20DESC`, 'Orders');
  if (orders) {
    const els = orders.elements || [];
    console.log(`✓ Orders readable — showing ${els.length} recent order(s)` + (els.length ? ':' : ' (no orders yet — create a few test orders in the sandbox)'));
    els.forEach(o => console.log(`    • ${new Date(o.createdTime).toLocaleString()}  $${((o.total || 0) / 100).toFixed(2)}  ${o.state || ''}`));
  }

  console.log(items && orders
    ? '\nAll good — this token can read what the ops dashboard needs.\n'
    : '\nConnected, but some reads failed — see the notes above.\n');
})();
