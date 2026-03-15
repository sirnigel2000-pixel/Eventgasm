
// POST /admin/sync/eventbrite-sitemap - Run Eventbrite sitemap scraper
router.post('/sync/eventbrite-sitemap', authMiddleware, async (req, res) => {
  try {
    const eventbriteSitemap = require('../services/eventbriteSitemapScraper');
    res.json({ message: 'Eventbrite sitemap sync started', status: 'running' });
    eventbriteSitemap.syncAll()
      .then(count => console.log(`[Admin] Eventbrite sitemap sync complete: +${count}`))
      .catch(err => console.error('[Admin] Eventbrite sitemap sync error:', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
