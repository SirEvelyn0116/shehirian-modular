const https = require('https');
const { requireRole, getRoles } = require('./_shared/requireRole');

exports.handler = async (event, context) => {
  // Governance: Only logged-in translators can trigger this
  const user = context.clientContext && context.clientContext.user;
  console.log('user:', JSON.stringify(user));
  console.log('roles:', JSON.stringify(getRoles(user)));

  const gate = requireRole('translator', context);
  if (!gate.ok) {
    console.log(`${gate.error} — returning ${gate.status}`);
    return { statusCode: gate.status, body: gate.error };
  }

  console.log('NETLIFY_BUILD_HOOK_ID:', process.env.NETLIFY_BUILD_HOOK_ID);
  console.log('body received:', event.body);

  // Parse the request body
  let totalChanges = 0;
  let totalKeys = 0;
  try {
    const body = JSON.parse(event.body);
    totalChanges = body.totalChanges || 0;
    totalKeys = body.totalKeys || 0;
  } catch (e) {
      // Non-fatal — proceed with zeros
    console.warn('Could not parse request body:', e.message);
  }

  const message = `Build triggered. Deploying ${totalChanges} change(s) across ${totalKeys} keys...`;

  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      hostname: 'api.netlify.com',
      path: `/build_hooks/${process.env.NETLIFY_BUILD_HOOK_ID}`, 
      headers: { 'Content-Type': 'application/json', 'Content-Length': 2 },
    };

    const req = https.request(options, (res) => {
      resolve({ statusCode: 200, body: message });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: `Error: ${e.message}` });
    });

    req.write('{}');
    req.end();
  });
};