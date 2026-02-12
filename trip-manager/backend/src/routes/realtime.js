const express = require('express');
const { openStream, getRealtimeStats } = require('../realtime/hub');

const router = express.Router();

router.get('/stream', (req, res) => {
  openStream(req, res);
});

router.get('/stats', (req, res) => {
  res.json(getRealtimeStats());
});

module.exports = router;
