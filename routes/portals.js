const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const PORTALS_FILE = path.join(__dirname, '../config/portals.yml');

function loadPortals() {
  try {
    const content = fs.readFileSync(PORTALS_FILE, 'utf8');
    return yaml.load(content);
  } catch (e) {
    return { categories: {} };
  }
}

function savePortals(data) {
  fs.writeFileSync(PORTALS_FILE, yaml.dump(data, { lineWidth: 120 }));
}

// GET all portals
router.get('/all', (req, res) => {
  const data = loadPortals();
  res.json({ success: true, portals: data.categories || {} });
});

// POST add a new portal
router.post('/add', (req, res) => {
  try {
    const { name, slug, type, category, ashbySlug, workdayId } = req.body;
    if (!name || !slug || !type || !category) {
      return res.status(400).json({ error: 'name, slug, type, category required' });
    }
    const data = loadPortals();
    if (!data.categories) data.categories = {};
    if (!data.categories[category]) {
      data.categories[category] = { label: category, portals: [] };
    }
    // Check for dupe
    const exists = data.categories[category].portals.some(p => p.slug === slug);
    if (exists) return res.status(400).json({ error: `Portal "${slug}" already exists in ${category}` });

    const portal = { name, slug, type };
    if (ashbySlug) portal.ashbySlug = ashbySlug;
    if (workdayId) portal.workdayId = workdayId;
    data.categories[category].portals.push(portal);
    savePortals(data);
    res.json({ success: true, message: `Added ${name} to ${category}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE a portal by slug
router.delete('/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const data = loadPortals();
    let removed = false;
    for (const cat of Object.values(data.categories || {})) {
      const before = cat.portals.length;
      cat.portals = cat.portals.filter(p => p.slug !== slug);
      if (cat.portals.length < before) removed = true;
    }
    if (!removed) return res.status(404).json({ error: `Portal "${slug}" not found` });
    savePortals(data);
    res.json({ success: true, message: `Removed ${slug}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT edit a portal
router.put('/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const updates = req.body;
    const data = loadPortals();
    let found = false;
    for (const cat of Object.values(data.categories || {})) {
      const portal = cat.portals.find(p => p.slug === slug);
      if (portal) {
        Object.assign(portal, updates);
        found = true;
        break;
      }
    }
    if (!found) return res.status(404).json({ error: `Portal "${slug}" not found` });
    savePortals(data);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
