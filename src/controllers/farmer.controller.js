const prisma = require('../config/prisma');

// exports.createFarmer = async (req, res) => {

//     try {

//         const farmer = await prisma.farmer.create({
//             data: req.body
//         });

//         res.status(201).json(farmer);

//     } catch (error) {

//         res.status(500).json({
//             message: error.message
//         });

//     }

// };

// CREATE FARMER
exports.createFarmer = async (req, res) => {
  try {
    const { full_name, phone_number, region, district } = req.body;

    const farmer = await prisma.farmer.create({
      data: {
        full_name,
        phone_number,
        region,
        district,
      },
    });

    res.status(201).json(farmer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL FARMERS
exports.getFarmers = async (req, res) => {
  try {
    const farmers = await prisma.farmer.findMany({
      include: {
        farms: true,
      },
    });

    res.json(farmers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET SINGLE FARMER
exports.getFarmerById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const farmer = await prisma.farmer.findUnique({
      where: { farmer_id: id },
      include: {
        farms: true,
      },
    });

    if (!farmer) {
      return res.status(404).json({ message: "Farmer not found" });
    }

    res.json(farmer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE FARMER
exports.updateFarmer = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { full_name, phone_number, region, district } = req.body;

    const farmer = await prisma.farmer.update({
      where: { farmer_id: id },
      data: {
        full_name,
        phone_number,
        region,
        district,
      },
    });

    res.json(farmer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE FARMER
exports.deleteFarmer = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    await prisma.farmer.delete({
      where: { farmer_id: id },
    });

    res.json({ message: "Farmer deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};