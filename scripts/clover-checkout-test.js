/**
 * Clover online-checkout test (SANDBOX): can the Canadian test merchant take
 * an online payment through Clover Hosted Checkout?
 *
 * Clover's docs conflict for Canada (the Hosted Checkout page lists US and
 * Canada; the region table lists the Ecommerce API as US-only), so this tries
 * it for real. It creates a checkout session for a small demo cart and prints
 * the Clover-hosted payment link — or explains why Clover refused.
 *
 * Hosted Checkout authenticates with the merchant's Ecommerce PRIVATE key, not
 * the regular REST API token. In the sandbox dashboard, open the test merchant:
 *   Settings > Ecommerce > Ecommerce API tokens  (create one; copy the private key)
 * and add to .env:
 *   CLOVER_ECOMM_PRIVATE_KEY=...
 * If that setting doesn't exist for the Canadian merchant, that is itself the
 * answer. Without the key, this script falls back to CLOVER_API_TOKEN so the
 * error Clover returns can still be read.
 *
 *   node scripts/clover-checkout-test.js
 */
require('dotenv').config();

const BASE = (process.env.CLOVER_API_BASE || 'https://apisandbox.dev.clover.com').replace(/\/+$/, '');
const MID = (process.env.CLOVER_MERCHANT_ID || '').trim();
const ECOMM = (process.env.CLOVER_ECOMM_PRIVATE_KEY || '').trim();
const KEY = ECOMM || (process.env.CLOVER_API_TOKEN || '').trim();

// Demo cart — placeholder prices (cents), same catalogue as the seed script.
const CART = [
  { name: 'Shirag Bulgor — Soft Wheat Fine 1Kg', unitQty: 2, price: 349 },
  { name: 'Mr. Falafel Mix — 5 lb', unitQty: 1, price: 1199 },
];

(async () => {
  console.log('Clover online-checkout test (sandbox)');
  if (!MID || !KEY) { console.error('✗ Set CLOVER_MERCHANT_ID and CLOVER_ECOMM_PRIVATE_KEY (or CLOVER_API_TOKEN) in .env'); process.exit(1); }
  if (!/apisandbox\.dev\.clover\.com/.test(BASE)) { console.error('✗ Refusing: this test only runs against the Clover sandbox.'); process.exit(1); }
  console.log(`  Merchant: ${MID}`);
  console.log(`  Using:    ${ECOMM ? 'Ecommerce private key (CLOVER_ECOMM_PRIVATE_KEY)' : 'regular API token (no CLOVER_ECOMM_PRIVATE_KEY yet)'}`);

  const res = await fetch(`${BASE}/invoicingcheckoutservice/v1/checkouts`, {
    method: 'POST',
    headers: { 'X-Clover-Merchant-Id': MID, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      customer: { firstName: 'Test', lastName: 'Customer', email: 'test.customer@example.com', phoneNumber: '416-555-0100' },
      shoppingCart: { lineItems: CART },
    }),
  }).catch(e => { console.error(`\n✗ Could not connect: ${e.cause?.code || e.message}`); process.exit(1); });

  const text = await res.text();
  let body = null; try { body = JSON.parse(text); } catch { /* not JSON */ }

  if (res.ok && body && body.href) {
    const exp = body.expirationTime ? new Date(body.expirationTime).toLocaleTimeString('en-CA') : 'in ~15 minutes';
    console.log('\n✓ Clover created an online checkout for the Canadian test merchant.');
    console.log(`\n  Open this link to pay (expires ${exp}):\n  ${body.href}\n`);
    console.log('  Pay with Clover\'s sandbox test card: 6011 3610 0000 6668, any future expiry, any CVV,');
    console.log('  any postal code. Then run  node scripts/clover-sandbox-check.js  — a PAID order should appear.');
    console.log(`\n  Session: ${body.checkoutSessionId || '(no id returned)'}`);
    return;
  }

  const msg = (body && (body.message || body.error || JSON.stringify(body))) || text.replace(/\s+/g, ' ').slice(0, 300);
  console.log(`\n✗ Clover refused the checkout: HTTP ${res.status}`);
  console.log(`  Clover said: ${msg}`);
  if (!ECOMM && (res.status === 401 || res.status === 403)) {
    console.log('\n  Expected with the regular API token — Hosted Checkout needs the Ecommerce private key.');
    console.log('  Next: sandbox dashboard > test merchant > Settings > Ecommerce > Ecommerce API tokens.');
    console.log('  If that option is missing for this Canadian merchant, online payments via Clover');
    console.log('  aren\'t available for Canadian accounts (in the sandbox, at least). If it exists, create a');
    console.log('  key, add CLOVER_ECOMM_PRIVATE_KEY=... to .env and run this again.');
  } else if (/region|country|not (supported|available|enabled)|ecommerce/i.test(msg)) {
    console.log('\n  This reads as a Canada/ecommerce restriction — online payments through Clover may not be');
    console.log('  available for this merchant. Worth confirming with the store\'s Clover rep.');
  } else {
    console.log('\n  Not a clear region message — paste this output and we\'ll read it together.');
  }
  process.exit(1);
})();
