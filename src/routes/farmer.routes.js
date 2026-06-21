const express = require('express');

const router = express.Router();

const farmerController = require('../controllers/farmer.controller');

router.post('/', farmerController.createFarmer);
router.get('/', farmerController.getFarmers);
router.get('/:id', farmerController.getFarmerById);
router.put('/:id', farmerController.updateFarmer);
router.delete('/:id', farmerController.deleteFarmer);

module.exports = router;