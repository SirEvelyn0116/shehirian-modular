const https = require('https');

exports.handler = async (event, context) => {
  // Governance: Only logged-in translators can trigger this
  const { user } = context.clientContext;
  const roles = user?.app_metadata?.authorization?.roles || [];
  if (!roles.includes('translator')) {
    return { statusCode: 403, body: "Unauthorized." };
  }

  // Parse the request body
  let totalChanges = 0;
  let totalKeys = 0;
  try {
    const body = JSON.parse(event.body);
    totalChanges = body.totalChanges || 0;
    totalKeys = body.totalKeys || 0;
  } catch (e) {
    return { statusCode: 400, body: "Invalid request body." };
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