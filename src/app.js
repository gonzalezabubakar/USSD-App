require('dotenv').config();

const express = require('express');

const cors = require('cors');

const farmerRoutes = require('./routes/farmer.routes');


const app = express();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({extended: true})); 


app.use('/api/farmers', farmerRoutes);

module.exports = app;