const https = require('https');

exports.handler = async (event, context) => {
  // Governance: Only logged-in translators can trigger this
  const { user } = context.clientContext;
  console.log('user:', JSON.stringify(user));

  const roles = user?.app_metadata?.authorization?.roles
   || user?.app_metadata?.roles
   || [];
  console.log('roles:', JSON.stringify(roles));

  if (!roles.includes('translator')) {
    console.log('Unauthorized — returning 403');
    return { statusCode: 403, body: "Unauthorized." };
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