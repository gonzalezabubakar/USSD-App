const prisma = require('../config/prisma');

exports.createFarmer = async (req, res) => {

    try {

        const farmer = await prisma.farmer.create({
            data: req.body
        });

        res.status(201).json(farmer);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};