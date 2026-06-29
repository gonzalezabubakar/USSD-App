// src/routes/admin.routes.js
const express = require('express');
const router = express.Router();
const excelSyncServiceController = require('../controllers/excelSync.controller'); // Vuta controller hapa

// Njia ya dharura: Sasa imenyooka na ipo standard kabisa!
router.post('/sync-emergency', excelSyncServiceController.forceEmergencySync);

module.exports = router;