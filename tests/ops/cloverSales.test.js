// node --test tests/ops/cloverSales.test.js
const test = require('node:test');
const assert = require('node:assert');
const { summarize } = require('../../netlify/functions/_shared/cloverSales');

// "now" = Wed 2026-09-30 (Toronto); weeks start Monday.
const NOW = Date.parse('2026-09-30T16:00:00Z');
const li = (name, price, unitQty) => ({ name, price, ...(unitQty ? { unitQty } : {}) });
const order = (extra, lines) => ({ lineItems: { elements: lines }, ...extra });

test('sandbox: buckets by demo tag, not createdTime', () => {
  const s = summarize([
    order({ title: 'demo:2026-09-26', total: 1000, createdTime: NOW }, [li('A', 1000)]),       // Sat of last week
    order({ title: 'demo:2026-09-29', total: 500, createdTime: NOW }, [li('B', 500)]),         // Tue this week
  ], { sandbox: true, now: NOW });
  assert.strictEqual(s.weeks.length, 6);
  assert.strictEqual(s.weeks[5].weekStart, '2026-09-28');
  assert.deepStrictEqual([s.weeks[4].orders, s.weeks[4].revenueCents], [1, 1000]);
  assert.deepStrictEqual([s.weeks[5].orders, s.weeks[5].revenueCents], [1, 500]);
  assert.strictEqual(s.weeks[5].current, true);
  assert.strictEqual(s.weekday.find(w => w.day === 'Sat').orders, 1);
});

test('sandbox: untagged orders fall back to createdTime', () => {
  const s = summarize([order({ total: 700, createdTime: NOW }, [li('C', 700)])], { sandbox: true, now: NOW });
  assert.strictEqual(s.totals.orders, 1);
  assert.strictEqual(s.weeks[5].orders, 1);
});

test('live: ignores demo tags and counts only PAID orders', () => {
  const s = summarize([
    order({ title: 'demo:2026-08-01', total: 999, createdTime: NOW, paymentState: 'PAID' }, [li('A', 999)]),
    order({ total: 400, createdTime: NOW, paymentState: 'OPEN' }, [li('B', 400)]),
  ], { sandbox: false, now: NOW });
  assert.strictEqual(s.totals.orders, 1);             // OPEN skipped
  assert.strictEqual(s.weeks[5].revenueCents, 999);   // tag ignored → dated by createdTime (this week)
});

test('orders outside the window are ignored', () => {
  const s = summarize([order({ title: 'demo:2026-01-05', total: 100 }, [li('A', 100)])], { sandbox: true, now: NOW });
  assert.strictEqual(s.totals.orders, 0);
  assert.strictEqual(s.busiestDay, null);
});

test('products: units per line item, revenue from price, unitQty in thousandths', () => {
  const s = summarize([
    order({ title: 'demo:2026-09-29', total: 0 }, [li('Bag', 300), li('Bag', 300), li('Bulk', 1000, 2500)]),
  ], { sandbox: true, now: NOW });
  const bag = s.topProducts.find(p => p.name === 'Bag');
  const bulk = s.topProducts.find(p => p.name === 'Bulk');
  assert.deepStrictEqual([bag.units, bag.revenueCents], [2, 600]);
  assert.deepStrictEqual([bulk.units, bulk.revenueCents], [2.5, 2500]);
  assert.strictEqual(s.totals.revenueCents, 3100);    // total 0 → falls back to line sum
  assert.strictEqual(s.topProducts[0].name, 'Bulk');  // sorted by revenue
  assert.strictEqual(s.totals.avgBasketCents, 3100);
});

test('Toronto local day: late-evening UTC-next-day order stays on the local day', () => {
  // 2026-09-29 23:30 Toronto = 2026-09-30 03:30 UTC → still Tuesday locally
  const s = summarize([order({ total: 100, createdTime: Date.parse('2026-09-30T03:30:00Z'), paymentState: 'PAID' }, [li('A', 100)])], { sandbox: false, now: NOW });
  assert.strictEqual(s.weekday.find(w => w.day === 'Tue').orders, 1);
});
