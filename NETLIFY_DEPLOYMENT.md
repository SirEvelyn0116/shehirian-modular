# Netlify Deployment Guide

## Quick Deploy (3 Steps)

### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

### 2. Login and Link
```bash
# Login to your Netlify account
netlify login

# Link this project to a new Netlify site
netlify init
```

### 3. Deploy
```bash
# Deploy to production
netlify deploy --prod
```

That's it! You'll get a URL like: `https://your-site-name.netlify.app`

---

## Your Tracking Endpoint

After deployment, your tracking endpoint will be at:
```
https://your-site-name.netlify.app/api/track-recipe
```

Update this URL in `assets/js/recipe-click-tracker.js`:
```javascript
const TRACKING_ENDPOINT = 'https://your-site-name.netlify.app/api/track-recipe';
```

---

## Configuration

### Update CORS (Important!)

Edit `netlify/functions/track-recipe.js` line 45:
```javascript
// Change from:
'Access-Control-Allow-Origin': '*',

// To your actual domain:
'Access-Control-Allow-Origin': 'https://your-actual-domain.com',
```

### Custom Domain (Optional)

If you have a custom domain:
1. Go to Netlify Dashboard → Domain Settings
2. Add your custom domain
3. Netlify will handle SSL certificates automatically

---

## ⚠️ Important: Data Persistence

**Note:** The current implementation uses the filesystem which is **ephemeral** in Netlify Functions (data resets between deploys).

### Production Options:

#### **Option A: Netlify Blobs** (Recommended - Free Tier)
```bash
npm install @netlify/blobs
```

Update the function to use Netlify Blobs for persistent storage.

#### **Option B: External Database**
- **MongoDB Atlas** (free tier: 512MB)
- **Supabase** (free tier: 500MB)
- **Firebase Firestore** (free tier: 1GB)

#### **Option C: GitHub as Storage**
- Use GitHub API to commit counter updates
- Pros: Free, version controlled
- Cons: Rate limits, not instant

---

## Testing Locally

```bash
# Install dependencies
npm install

# Start Netlify Dev server
netlify dev

# Test endpoint
curl -X POST http://localhost:8888/api/track-recipe \
  -H "Content-Type: application/json" \
  -d '{"slug":"royal-soup"}'
```

---

## Deployment Commands

```bash
# Deploy to preview
netlify deploy

# Deploy to production
netlify deploy --prod

# View logs
netlify functions:log track-recipe

# Check status
netlify status
```

---

## Environment Variables

If you need to add secrets (like database credentials):

```bash
# Set via CLI
netlify env:set DB_CONNECTION_STRING "your-value"

# Or via Netlify Dashboard:
# Site Settings → Environment Variables
```

Access in your function:
```javascript
const dbUrl = process.env.DB_CONNECTION_STRING;
```

---

## Troubleshooting

### Function not found
- Check `netlify.toml` has correct `functions` path
- Ensure file is in `netlify/functions/` directory
- File must be named with `.js` extension

### CORS errors
- Update `Access-Control-Allow-Origin` header
- Check browser console for specific error
- Test with `curl` to isolate issue

### Data not persisting
- Expected behavior with current filesystem implementation
- Implement Netlify Blobs or external database for persistence

---

## Next Steps After Deployment

1. ✅ Deploy to Netlify
2. ✅ Get your function URL
3. ✅ Update `TRACKING_ENDPOINT` in client tracker
4. ✅ Configure CORS with your actual domain
5. ✅ Choose persistence solution (Netlify Blobs or external DB)
6. ✅ Test with real clicks
7. ✅ Run `npm run track:update-featured` periodically

---

## Cost

**Free Tier Includes:**
- 125K function invocations/month
- 100GB bandwidth/month
- Automatic SSL certificates
- Global CDN

For a recipe tracking system, you'll likely stay well within free tier limits.
