/**
 * Seed the Clover SANDBOX test merchant with storefront-like demo data for the
 * ops dashboard: their product line as inventory items (the two Bulgor types,
 * each grade in each bag size, named as on shehirian.com/Products), plus ~6 weeks
 * of realistic storefront orders.
 *
 * DEMO DATA ONLY. Prices are placeholders, not Shehirian's real prices.
 *
 * Clover sets an order's timestamp itself and the API cannot backdate it, so
 * every seeded order carries the date it represents in its title, e.g.
 * "demo:2026-09-03". In sandbox mode the ops panel groups by that tag; against
 * the real account it uses Clover's own timestamps and ignores tags.
 *
 * Uses CLOVER_SEED_TOKEN if set, otherwise CLOVER_API_TOKEN (needs write
 * access to Inventory and Orders), plus CLOVER_MERCHANT_ID, from .env.
 *
 *   node scripts/clover-sandbox-seed.js --dry-run   # show the plan, no API calls
 *   node scripts/clover-sandbox-seed.js             # seed (refuses if demo orders exist)
 *   node scripts/clover-sandbox-seed.js --reset     # delete earlier demo orders, then seed
 */
require('dotenv').config();

const BASE = (process.env.CLOVER_API_BASE || 'https://apisandbox.dev.clover.com').replace(/\/+$/, '');
const TOKEN = (process.env.CLOVER_SEED_TOKEN || process.env.CLOVER_API_TOKEN || '').trim();
const MID = (process.env.CLOVER_MERCHANT_ID || '').trim();
const DRY = process.argv.includes('--dry-run');
const RESET = process.argv.includes('--reset');
const DAYS = 42;

// Their real product line, named as on shehirian.com/Products: two types of Bulgor,
// each grade in the four bag sizes the site lists. Prices are demo placeholders (cents).
const TYPES = [
  { type: 'Soft Wheat Bulgor', code: 'SW', grades: [['Fine', 'F', 22], ['Medium', 'M', 30], ['Coarse', 'C', 14], ['Extra Coarse', 'XC', 8]],
    prices: { '1Kg': 349, '2Kg': 599, '5Kg': 1299, '25Kg': 4999 } },
  { type: 'Red Wheat Bulgor', code: 'RW', grades: [['Fine', 'F', 10], ['Medium', 'M', 10], ['Coarse', 'C', 6]],
    prices: { '1Kg': 399, '2Kg': 699, '5Kg': 1499, '25Kg': 5799 } },
];
const SIZES = [['1Kg', 40], ['2Kg', 30], ['5Kg', 20], ['25Kg', 10]]; // walk-ins mostly buy small bags
const PRODUCTS = [];
for (const t of TYPES) for (const [grade, g, gw] of t.grades) for (const [size, sw] of SIZES) {
  PRODUCTS.push({ name: `${t.type} — ${grade} ${size}`, sku: `${t.code}-${g}-${size.replace('Kg', '')}`, price: t.prices[size], size, weight: gw * sw });
}
// Items from earlier versions of this script (one item per grade, "Shirag" prefix) — removed on re-seed.
const OBSOLETE_ITEM_PREFIXES = ['Shirag Bulgor —', 'Shirag Bulgur —'];
const CLOVER_DEFAULT_ITEMS = ['Kiwi', 'Banana', 'Pear', 'Apple']; // placeholder fruit on new test merchants

// ---------- deterministic demo data ----------
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry32(1729);
const pick = (arr, w) => { let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < arr.length; i++) { if ((r -= w[i]) < 0) return arr[i]; } return arr[arr.length - 1]; };
const DOW_FACTOR = [0.6, 1.0, 0.9, 1.0, 1.1, 1.3, 1.6]; // Sun..Sat — Saturdays busiest
const ymd = d => d.toISOString().slice(0, 10);

function planOrders() {
  const orders = [];
  const today = new Date(); today.setUTCHours(12, 0, 0, 0);
  for (let k = DAYS; k >= 1; k--) {
    const d = new Date(today); d.setUTCDate(d.getUTCDate() - k);
    const trend = 1 + 0.25 * ((DAYS - k) / DAYS);             // gentle growth over the period
    const n = Math.max(1, Math.round(5 * DOW_FACTOR[d.getUTCDay()] * trend * (0.75 + rnd() * 0.5)));
    for (let i = 0; i < n; i++) {
      const lines = []; const nLines = pick([1, 2, 3], [55, 32, 13]);
      const chosen = new Set();
      while (chosen.size < nLines) chosen.add(pick(PRODUCTS, PRODUCTS.map(p => p.weight)));
      for (const p of chosen) lines.push({ product: p, qty: p.size === '25Kg' ? 1 : pick([1, 2, 3], [70, 24, 6]) });
      orders.push({ date: ymd(d), lines, total: lines.reduce((s, l) => s + l.product.price * l.qty, 0) });
    }
  }
  return orders;
}

// ---------- Clover API ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
let calls = 0;
async function api(method, path, body) {
  for (let attempt = 0; attempt < 6; attempt++) {
    calls++;
    const res = await fetch(BASE + path, {
      method, headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    const text = await res.text();
    if (!res.ok) {
      const hint = res.status === 401 ? ' (token invalid or from another environment)'
        : res.status === 403 ? ' (token lacks WRITE permission for Inventory/Orders — edit the token\'s permissions)'
        : res.status === 404 ? ' (wrong merchant ID?)' : '';
      throw new Error(`${method} ${path} -> HTTP ${res.status}${hint}: ${text.slice(0, 200)}`);
    }
    await sleep(110); // stay well under sandbox rate limits
    return text ? JSON.parse(text) : {};
  }
  throw new Error(`${method} ${path} -> still rate-limited after retries`);
}
async function getAll(path) {
  const out = []; let offset = 0;
  for (;;) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await api('GET', `${path}${sep}limit=500&offset=${offset}`);
    const els = page.elements || []; out.push(...els);
    if (els.length < 500) return out; offset += 500;
  }
}

(async () => {
  const plan = planOrders();
  const units = plan.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);
  console.log(`Plan: ${PRODUCTS.length} products, ${plan.length} orders over ${DAYS} days (${plan[0].date} → ${plan[plan.length - 1].date}), ${units} units, $${(plan.reduce((s, o) => s + o.total, 0) / 100).toFixed(2)} demo revenue.`);
  if (DRY) {
    const byWeek = {};
    plan.forEach(o => { const d = new Date(o.date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); const w = ymd(d); byWeek[w] = byWeek[w] || { orders: 0, cents: 0 }; byWeek[w].orders++; byWeek[w].cents += o.total; });
    console.log('\nWeek of      Orders   Demo revenue');
    Object.entries(byWeek).forEach(([w, v]) => console.log(`${w}   ${String(v.orders).padStart(5)}   $${(v.cents / 100).toFixed(2).padStart(9)}`));
    const byProd = {}; plan.forEach(o => o.lines.forEach(l => { byProd[l.product.name] = (byProd[l.product.name] || 0) + l.qty; }));
    console.log('\nUnits by product:'); Object.entries(byProd).sort((a, b) => b[1] - a[1]).forEach(([n, q]) => console.log(`  ${String(q).padStart(4)}  ${n}`));
    console.log('\nSample order:', JSON.stringify({ title: 'demo:' + plan[0].date, lines: plan[0].lines.map(l => `${l.qty} × ${l.product.name}`), total: plan[0].total }));
    const est = PRODUCTS.length + plan.reduce((s, o) => s + 2 + o.lines.reduce((a, l) => a + l.qty, 0), 0);
    console.log(`\nDry run — no API calls made. A real run makes about ${est} API calls (~${Math.ceil(est * 0.15 / 60)} min).`);
    return;
  }
  if (!TOKEN || !MID) { console.error('Set CLOVER_API_TOKEN (or CLOVER_SEED_TOKEN) and CLOVER_MERCHANT_ID in .env'); process.exit(1); }
  if (!/apisandbox/.test(BASE)) { console.error('Refusing to seed: CLOVER_API_BASE is not the sandbox. Demo data must never go into a real account.'); process.exit(1); }

  // Guard against double-seeding
  const existing = (await getAll(`/v3/merchants/${MID}/orders`)).filter(o => (o.title || '').startsWith('demo:'));
  if (existing.length && !RESET) { console.error(`\n${existing.length} demo orders already exist. Run with --reset to delete them and re-seed.`); process.exit(1); }
  if (existing.length) {
    console.log(`Deleting ${existing.length} earlier demo orders…`);
    for (const o of existing) await api('DELETE', `/v3/merchants/${MID}/orders/${o.id}`);
  }

  // Inventory: remove Clover's placeholder fruit, create/reuse the Shirag items
  const items = await getAll(`/v3/merchants/${MID}/items`);
  for (const it of items.filter(i => CLOVER_DEFAULT_ITEMS.includes(i.name) || OBSOLETE_ITEM_PREFIXES.some(p => (i.name || '').startsWith(p)))) {
    await api('DELETE', `/v3/merchants/${MID}/items/${it.id}`); console.log(`  removed old item: ${it.name}`);
  }
  const idByName = {};
  for (const p of PRODUCTS) {
    const found = items.find(i => i.name === p.name);
    if (found) { idByName[p.name] = found.id; continue; }
    const created = await api('POST', `/v3/merchants/${MID}/items`, { name: p.name, sku: p.sku, price: p.price, priceType: 'FIXED' });
    idByName[p.name] = created.id; console.log(`  created item: ${p.name}`);
  }

  // Orders
  let done = 0;
  for (const o of plan) {
    const order = await api('POST', `/v3/merchants/${MID}/orders`, { state: 'open', title: 'demo:' + o.date, note: 'Demo order — seeded by scripts/clover-sandbox-seed.js' });
    for (const l of o.lines) for (let q = 0; q < l.qty; q++) {
      await api('POST', `/v3/merchants/${MID}/orders/${order.id}/line_items`, { item: { id: idByName[l.product.name] }, name: l.product.name, price: l.product.price });
    }
    await api('POST', `/v3/merchants/${MID}/orders/${order.id}`, { total: o.total });
    if (++done % 25 === 0 || done === plan.length) console.log(`  ${done}/${plan.length} orders`);
  }
  console.log(`\n✓ Seeded ${plan.length} demo orders and ${PRODUCTS.length} products (${calls} API calls). Run scripts/clover-sandbox-check.js to see them.`);
})().catch(e => { console.error('\n✗ ' + e.message); process.exit(1); });
