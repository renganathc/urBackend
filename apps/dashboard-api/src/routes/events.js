const express = require('express');
const router = express.Router();
const { track } = require('../controllers/events.controller');

// Middleware: dashboard JWT auth
const { verifyEmail } = require('@urbackend/common');

/**
 * POST /api/events/track
 * Receives frontend analytics events (onboarding steps, key copy, etc.)
 * Requires a valid dashboard session.
 */
router.post('/track', verifyEmail, track);

module.exports = router;
