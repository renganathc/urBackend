const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const authMiddleware = require('../middlewares/authMiddleware');

// POST /api/projects/:projectId/export
router.post('/:projectId/export', authMiddleware, projectController.dbExportHandler);

module.exports = router;
