const express = require('express');
const router = express.Router();
const ussdController = require('../controllers/ussd.controller');

// Hapa tunasema: Kila request ya POST itakayokuja, iende kwenye handleUssd yetu
router.post('/callback', ussdController.handleUssd);

module.exports = router;