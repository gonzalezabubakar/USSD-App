// src/routes/farm.routes.js
const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farm.controller');


router.post('/', farmController.createFarm);
router.get('/', farmController.getAllFarms);
router.get('/:id', farmController.getFarmById);
router.put('/:id', farmController.updateFarm);
router.delete('/:id', farmController.deleteFarm);

module.exports = router;