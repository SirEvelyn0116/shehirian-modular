// Netlify Function for recipe click tracking
const fs = require('fs');
const path = require('path');

// Use /tmp for serverless environment write access
const COUNTERS_FILE = path.join('/tmp', 'counters.json');
const COUNTERS_BACKUP = path.join(__dirname, '..', '..', 'serverless', 'data', 'counters.json');

/**
 * Load counters from file or backup
 */
function loadCounters() {
  try {
    // Try temp directory first
    if (fs.existsSync(COUNTERS_FILE)) {
      return JSON.parse(fs.readFileSync(COUNTERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not read temp counters:', err.message);
  }

  try {
    // Fall back to backup
    if (fs.existsSync(COUNTERS_BACKUP)) {
      return JSON.parse(fs.readFileSync(COUNTERS_BACKUP, 'utf8'));
    }
  } catch (err) {
    console.warn('Could not read backup counters:', err.message);
  }

  return {};
}

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': 'https://gleeful-sfogliatella-82181f.netlify.app'  
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request
    const body = JSON.parse(event.body);
    const { slug, timestamp, referrer } = body;

    // Validate slug
    if (!slug || typeof slug !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid slug' })
      };
    }

    // Sanitize slug (prevent path traversal)
    const sanitizedSlug = slug.replace(/[^a-z0-9-]/gi, '');
    if (sanitizedSlug !== slug || slug.length > 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid slug format' })
      };
    }

    // Load existing counters
    let counters = loadCounters();

    // Increment counter
    if (!counters[slug]) {
      counters[slug] = {
        count: 0,
        firstSeen: timestamp || new Date().toISOString(),
        lastSeen: timestamp || new Date().toISOString()
      };
    }
    
    counters[slug].count += 1;
    counters[slug].lastSeen = timestamp || new Date().toISOString();
    
    if (referrer && referrer !== 'direct') {
      counters[slug].referrer = referrer;
    }

    // Save to temp directory (survives for duration of function execution)
    try {
      fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf8');
    } catch (err) {
      console.warn('Could not write temp counters:', err.message);
    }

    // Note: In production, you'd want to save to a database or external storage
    // Netlify Functions have ephemeral filesystem - data resets between deploys
    console.log(`✓ Tracked: ${slug} (${counters[slug].count} total)`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        slug: slug,
        count: counters[slug].count,
        note: 'Using ephemeral storage - consider using Netlify Blobs or external DB for persistence'
      })
    };

  } catch (error) {
    console.error('Error tracking recipe click:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
