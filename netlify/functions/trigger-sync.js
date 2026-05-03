const https = require('https');

exports.handler = async (event, context) => {
  // Governance: Only logged-in translators can trigger this
  const { user } = context.clientContext;
  if (!user || !user.app_metadata.roles.includes('translator')) {
    return { statusCode: 403, body: "Unauthorized." };
  }

  return new Promise((resolve) => {
    const options = {
      method: 'POST',
      hostname: 'api.netlify.com',
      path: `/build_hooks/${process.env.NETLIFY_BUILD_HOOK_ID}`, // Just the ID part
    };

    const req = https.request(options, (res) => {
      resolve({ statusCode: 200, body: "Build triggered. Rebuilding 212+ pages..." });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: `Error: ${e.message}` });
    });

    req.end();
  });
};