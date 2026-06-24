// src/controllers/farm.controller.js
const prisma = require('../config/prisma');

// ==========================================
// 1. CREATE: Kusajili Shamba Jipya (POST)
// ==========================================
exports.createFarm = async (req, res) => {
    try {
        const { farmer_id, crop_id, farm_size } = req.body;

        if (!farmer_id || !crop_id) {
            return res.status(400).json({ message: "farmer_id na crop_id ni lazima ziwekwe." });
        }

        const newFarm = await prisma.farm.create({
            data: {
                farmer_id: parseInt(farmer_id),
                crop_id: parseInt(crop_id),
                farm_size: farm_size ? parseFloat(farm_size) : null
            },
            include: { farmer: true, crop: true }
        });

        res.status(201).json({ message: "Shamba limesajiliwa kikamilifu!", data: newFarm });
    } catch (error) {
        res.status(500).json({ message: "Imeshindikana kusajili shamba.", error: error.message });
    }
};

// ==========================================
// 2. READ: Kupata Orodha ya Mashamba (GET)
// ==========================================

// A. Kupata mashamba yote yaliyopo kwenye mfumo
exports.getAllFarms = async (req, res) => {
    try {
        const farms = await prisma.farm.findMany({
            include: { farmer: true, crop: true }
        });
        res.status(200).json({ total: farms.length, data: farms });
    } catch (error) {
        res.status(500).json({ message: "Imeshindikana kupata mashamba.", error: error.message });
    }
};

// B. Kupata shamba moja tu kwa kutumia farm_id yake
exports.getFarmById = async (req, res) => {
    try {
        const { id } = req.params;
        const farm = await prisma.farm.findUnique({
            where: { farm_id: parseInt(id) },
            include: { farmer: true, crop: true }
        });

        if (!farm) {
            return res.status(404).json({ message: "Shamba halijapatikana." });
        }
        res.status(200).json(farm);
    } catch (error) {
        res.status(500).json({ message: "Hitilafu imetokea.", error: error.message });
    }
};

// ==========================================
// 3. UPDATE: Kurekebisha Data za Shamba (PUT)
// ==========================================
exports.updateFarm = async (req, res) => {
    try {
        const { id } = req.params;
        const { crop_id, farm_size } = req.body;

        // Angalia kama shamba lipo kwanza
        const farmExists = await prisma.farm.findUnique({
            where: { farm_id: parseInt(id) }
        });

        if (!farmExists) {
            return res.status(404).json({ message: "Shamba unalotaka kurekebisha halipo." });
        }

        const updatedFarm = await prisma.farm.update({
            where: { farm_id: parseInt(id) },
            data: {
                crop_id: crop_id ? parseInt(crop_id) : undefined,
                farm_size: farm_size ? parseFloat(farm_size) : undefined
            },
            include: { farmer: true, crop: true }
        });

        res.status(200).json({ message: "Data za shamba zimebadilishwa!", data: updatedFarm });
    } catch (error) {
        res.status(500).json({ message: "Imeshindikana kurekebisha shamba.", error: error.message });
    }
};

// ==========================================
// 4. DELETE: Kufuta Shamba (DELETE)
// ==========================================
exports.deleteFarm = async (req, res) => {
    try {
        const { id } = req.params;

        const farmExists = await prisma.farm.findUnique({
            where: { farm_id: parseInt(id) }
        });

        if (!farmExists) {
            return res.status(404).json({ message: "Shamba unalotaka kufuta halipo." });
        }

        await prisma.farm.delete({
            where: { farm_id: parseInt(id) }
        });

        res.status(200).json({ message: `Shamba lenye ID namba ${id} limefutwa kikamilifu!` });
    } catch (error) {
        res.status(500).json({ message: "Imeshindikana kufuta shamba.", error: error.message });
    }
};