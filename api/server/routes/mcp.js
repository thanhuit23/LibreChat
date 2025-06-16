const express = require('express');
const router = express.Router();
const { requireJwtAuth } = require('~/server/middleware');
const { getMCPs } = require('~/models/MCPs');

router.get('/', requireJwtAuth, async (req, res) => {
  try {
    const mcps = await getMCPs();
    
    res.status(200).send(mcps);
  } catch (error) {
    res.status(500).send({ message: 'Failed to retrieve categories', error: error.message });
  }
});

module.exports = router;
