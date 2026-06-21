const express = require('express');

const router = express.Router();

const farmerController =
require('../controllers/farmer.controller');

router.post(
    '/',
    farmerController.createFarmer
);

module.exports = router;