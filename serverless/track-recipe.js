// Serverless endpoint to track recipe clicks
// Deploy as AWS Lambda, Azure Function, or Firebase Function

const fs = require('fs').promises;
const path = require('path');

// Configuration
const COUNTERS_FILE = path.join(__dirname, 'data', 'counters.json');

/**
 * Main handler function
 * @param {Object} event - Request event (API Gateway for AWS, HTTP request for Azure/Firebase)
 * @param {Object} context - Execution context
 * @returns {Object} HTTP response
 */
exports.handler = async (event, context) => {
  // CORS headers (adjust origins as needed)
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Replace with your domain
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request body
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
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
    let counters = {};
    try {
      const data = await fs.readFile(COUNTERS_FILE, 'utf8');
      counters = JSON.parse(data);
    } catch (err) {
      // File doesn't exist yet, start fresh
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    // Increment counter for this recipe
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

    // Save updated counters
    await fs.mkdir(path.dirname(COUNTERS_FILE), { recursive: true });
    await fs.writeFile(COUNTERS_FILE, JSON.stringify(counters, null, 2), 'utf8');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        slug: slug,
        count: counters[slug].count 
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

// For local testing with Express
if (require.main === module) {
  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.post('/api/track-recipe', async (req, res) => {
    const result = await exports.handler({
      httpMethod: 'POST',
      body: JSON.stringify(req.body)
    }, {});
    
    res.status(result.statusCode).json(JSON.parse(result.body));
  });

  app.listen(PORT, () => {
    console.log(`Local test server running on http://localhost:${PORT}`);
    console.log(`Test endpoint: POST http://localhost:${PORT}/api/track-recipe`);
  });
}
