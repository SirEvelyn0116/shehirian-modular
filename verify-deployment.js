/**
 * Manual Deployment Verification Script
 * Tests the deployed site at https://SirEvelyn0116.github.io/shehirian-modular
 */

const https = require('https');

const BASE_URL = 'https://sirevelyn0116.github.io/shehirian-modular';

function checkURL(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      const { statusCode } = res;
      res.resume(); // Consume response data to free up memory
      resolve({ url, status: statusCode, ok: statusCode === 200 });
    }).on('error', (err) => {
      resolve({ url, status: 'ERROR', ok: false, error: err.message });
    });
  });
}

async function verifyDeployment() {
  console.log('🔍 Verifying Deployed Site at:', BASE_URL);
  console.log('='.repeat(60));
  
  const checks = [
    { name: 'Root redirect (index.html)', url: `${BASE_URL}/` },
    { name: 'English page', url: `${BASE_URL}/index.en.html` },
    { name: 'French page', url: `${BASE_URL}/index.fr.html` },
    { name: 'Arabic page', url: `${BASE_URL}/index.ar.html` },
    { name: 'CSS file', url: `${BASE_URL}/assets/css/style.css` },
    { name: 'Preview.js', url: `${BASE_URL}/preview.js` },
    { name: 'Hero render', url: `${BASE_URL}/sections/hero/render.js` },
    { name: 'About Us render', url: `${BASE_URL}/sections/aboutUs/render.js` },
  ];
  
  const results = [];
  
  for (const check of checks) {
    const result = await checkURL(check.url);
    results.push({ ...check, ...result });
    
    const icon = result.ok ? '✅' : '❌';
    const status = result.status === 'ERROR' ? `ERROR: ${result.error}` : result.status;
    console.log(`${icon} ${check.name.padEnd(30)} [${status}]`);
  }
  
  console.log('='.repeat(60));
  
  const passedCount = results.filter(r => r.ok).length;
  const totalCount = results.length;
  
  if (passedCount === totalCount) {
    console.log(`✅ ALL CHECKS PASSED (${passedCount}/${totalCount})`);
    console.log('\n✨ Site is deployed and accessible!');
  } else {
    console.log(`❌ SOME CHECKS FAILED (${passedCount}/${totalCount})`);
    console.log('\n⚠️  Site may not be fully deployed yet.');
    console.log('💡 Suggestions:');
    console.log('   1. Check GitHub Actions workflow status');
    console.log('   2. Verify gh-pages branch exists and has content');
    console.log('   3. Ensure GitHub Pages is enabled in repository settings');
    console.log('   4. Wait a few minutes for deployment to complete');
  }
  
  return passedCount === totalCount;
}

verifyDeployment().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
