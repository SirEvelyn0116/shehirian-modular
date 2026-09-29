// Pure summary of Clover orders for the ops dashboard's in-store sales panel.
// No I/O — orders in, plain data out — so it can be unit-tested offline
// (tests/ops/cloverSales.test.js), same pattern as _shared/approveLogic.js.
//
// Dates: Clover sets order timestamps itself and its API can't backdate them,
// so sandbox demo orders carry the date they represent in their title
// ("demo:YYYY-MM-DD", see scripts/clover-sandbox-seed.js). In sandbox mode that
// tag wins when present; otherwise (and always in live mode) the order's
// createdTime is used, bucketed by the store's local day (America/Toronto).
//
// Live mode counts only paid orders. Sandbox demo orders can't be paid through
// the API, so sandbox mode counts every order.

const DAY_MS = 86400000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const torontoDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' });

// A calendar day as a Date at 12:00 UTC (stable across DST for weekday/week math).
function dayOf(ms) { return new Date(torontoDay.format(new Date(ms)) + 'T12:00:00Z'); }

function orderDay(order, sandbox) {
  if (sandbox) {
    const m = /^demo:(\d{4}-\d{2}-\d{2})\b/.exec(order.title || '');
    if (m) return new Date(m[1] + 'T12:00:00Z');
  }
  return typeof order.createdTime === 'number' ? dayOf(order.createdTime) : null;
}

function mondayOf(day) {
  const d = new Date(day);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

function summarize(orders, { sandbox = true, now = Date.now(), weeks = 6, topN = 6 } = {}) {
  const thisWeek = mondayOf(dayOf(now));
  const first = new Date(thisWeek); first.setUTCDate(first.getUTCDate() - 7 * (weeks - 1));

  const buckets = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(first); d.setUTCDate(d.getUTCDate() + 7 * i);
    return { weekStart: d.toISOString().slice(0, 10), orders: 0, revenueCents: 0, current: i === weeks - 1 };
  });
  const products = new Map();
  const weekday = WEEKDAYS.map(day => ({ day, orders: 0 }));
  let orderCount = 0, revenueCents = 0, units = 0;

  for (const o of orders || []) {
    if (!sandbox && o.paymentState !== 'PAID') continue;
    const day = orderDay(o, sandbox);
    if (!day) continue;
    const idx = Math.round((mondayOf(day) - first) / (7 * DAY_MS));
    if (idx < 0 || idx >= weeks) continue;

    const lines = (o.lineItems && o.lineItems.elements) || [];
    let lineTotal = 0;
    for (const l of lines) {
      const qty = typeof l.unitQty === 'number' && l.unitQty > 0 ? l.unitQty / 1000 : 1; // unitQty is in thousandths
      const cents = Math.round((l.price || 0) * qty);
      const name = (l.name || '(unnamed item)').trim();
      const p = products.get(name) || { name, units: 0, revenueCents: 0 };
      p.units += qty; p.revenueCents += cents;
      products.set(name, p);
      units += qty; lineTotal += cents;
    }
    const total = typeof o.total === 'number' && o.total > 0 ? o.total : lineTotal;

    buckets[idx].orders++; buckets[idx].revenueCents += total;
    weekday[(day.getUTCDay() + 6) % 7].orders++;
    orderCount++; revenueCents += total;
  }

  const topProducts = [...products.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents || b.units - a.units)
    .slice(0, topN);
  const busiest = weekday.reduce((a, b) => (b.orders > a.orders ? b : a), weekday[0]);

  return {
    period: { from: buckets[0].weekStart, weeks },
    totals: {
      orders: orderCount,
      revenueCents,
      units: Math.round(units * 1000) / 1000,
      avgBasketCents: orderCount ? Math.round(revenueCents / orderCount) : 0,
    },
    weeks: buckets,
    topProducts,
    productCount: products.size,
    weekday,
    busiestDay: orderCount ? busiest.day : null,
  };
}

module.exports = { summarize, WEEKDAYS };
