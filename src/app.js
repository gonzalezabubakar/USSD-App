require('dotenv').config();

const express = require('express');

const cors = require('cors');

const farmerRoutes = require('./routes/farmer.routes');
const ussdRoutes = require('./routes/ussd.routes');
const farmRoutes = require('./routes/farm.routes');

const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({extended: true})); 


app.use('/ussd', ussdRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/farmers', farmerRoutes);

module.exports = app;