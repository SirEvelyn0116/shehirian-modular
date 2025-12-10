// Lightweight click tracker for recipe cards
// Sends slug to serverless endpoint when recipe card is clicked

(function() {
  'use strict';

  // Configuration - update this URL to your deployed serverless endpoint
  const TRACKING_ENDPOINT = 'https://your-function-url.com/api/track-recipe';
  
  // Debounce to prevent duplicate tracking on double-clicks
  const trackedClicks = new Set();
  const DEBOUNCE_MS = 1000;

  function trackRecipeClick(slug) {
    // Skip if recently tracked
    if (trackedClicks.has(slug)) {
      return;
    }
    
    trackedClicks.add(slug);
    setTimeout(() => trackedClicks.delete(slug), DEBOUNCE_MS);

    // Send tracking data (fire and forget - don't block navigation)
    const data = {
      slug: slug,
      timestamp: new Date().toISOString(),
      referrer: document.referrer || 'direct'
    };

    // Use sendBeacon if available (won't block navigation)
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(TRACKING_ENDPOINT, blob);
    } else {
      // Fallback: fetch with keepalive
      fetch(TRACKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(() => {
        // Silent fail - don't disrupt user experience
      });
    }
  }

  // Attach click handlers to all recipe card links
  function initTracker() {
    // Target all recipe card links (adjust selector to match your HTML structure)
    const recipeCards = document.querySelectorAll('a.recipe-card[href*=".html"]');
    
    recipeCards.forEach(card => {
      card.addEventListener('click', function(e) {
        // Extract slug from href attribute
        // Assumes format: <slug>.en.html, <slug>.fr.html, etc.
        const href = this.getAttribute('href');
        const match = href.match(/([^\/]+)\.(en|fr|ar)\.html$/);
        
        if (match) {
          const slug = match[1];
          trackRecipeClick(slug);
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTracker);
  } else {
    initTracker();
  }
})();
