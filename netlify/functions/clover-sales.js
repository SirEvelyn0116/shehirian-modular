// GET /api/ops/clover-sales — approver-only summary of in-store (Clover POS)
// sales for the ops dashboard's "In-store sales" panel (admin/ops.html).
//
// Reads orders server-side with CLOVER_API_TOKEN / CLOVER_MERCHANT_ID (Netlify
// env; never sent to the browser) and returns only aggregated figures.
// CLOVER_API_BASE defaults to the North America sandbox API; while it points
// at the sandbox the response is flagged mode:"sandbox" and the panel labels it
// as demo data. Pointing it at https://api.clover.com (with a production
// token for the store's own account) switches to live data.
const { requireRole } = require('./_shared/requireRole');
const { summarize } = require('./_shared/cloverSales');

const DAY_MS = 86400000;
const MAX_PAGES = 50; // 100 orders/page — bounds the call if an account is huge

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=120' }, body: JSON.stringify(body) };
}

async function fetchOrders(base, mid, token, sinceMs) {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ expand: 'lineItems', limit: '100', offset: String(page * 100) });
    if (sinceMs) params.append('filter', `createdTime>=${sinceMs}`);
    const res = await fetch(`${base}/v3/merchants/${mid}/orders?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      const reason = res.status === 401 ? 'token rejected' : res.status === 403 ? 'token lacks read permission for Orders'
        : res.status === 404 ? 'merchant not found' : `HTTP ${res.status}`;
      throw new Error(reason);
    }
    const els = (await res.json()).elements || [];
    all.push(...els);
    if (els.length < 100) break;
  }
  return all;
}

exports.handler = async (event, context) => {
  const gate = requireRole('approver', context);
  if (!gate.ok) return json(gate.status, { error: gate.error });

  const token = (process.env.CLOVER_API_TOKEN || '').trim();
  const mid = (process.env.CLOVER_MERCHANT_ID || '').trim();
  if (!token || !mid) {
    return json(503, { error: 'Clover is not connected yet.', code: 'not_configured' });
  }
  const base = (process.env.CLOVER_API_BASE || 'https://apisandbox.dev.clover.com').replace(/\/+$/, '');
  const sandbox = /apisandbox\.dev\.clover\.com/.test(base);

  try {
    // Live: only fetch what the 6-week window needs. Sandbox: demo orders are
    // all created on the day they were seeded, so their createdTime says
    // nothing about the date they represent — fetch them all (a few hundred).
    const since = sandbox ? null : Date.now() - 7 * 7 * DAY_MS;
    const orders = await fetchOrders(base, mid, token, since);
    return json(200, { mode: sandbox ? 'sandbox' : 'live', generatedAt: new Date().toISOString(), ...summarize(orders, { sandbox }) });
  } catch (e) {
    return json(502, { error: `Couldn't read orders from Clover (${e.message}).` });
  }
};
