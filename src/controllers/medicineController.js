const { Op } = require("sequelize");
const Medicine = require("../models/Medicine");

exports.searchMedicine = async (req, res) => {
  try {
    const keyword = req.query.q;

    if (!keyword) {
      return res.status(400).json({
        message: "Search keyword is required",
      });
    }

    const medicines = await Medicine.findAll({
      where: {
        medicine_name: {
          [Op.iLike]: `%${keyword}%`,
        },
      },

      attributes: [
        "medicine_id",
        "medicine_name",
        "manufacturer",
        "composition",
      ],

      limit: 20,
    });

    res.json(medicines);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.createMedicine = async (req, res) => {
  try {
    const { medicine_name, manufacturer, composition, category, hsn_code, gst_percent, barcode } = req.body || {};

    if (!medicine_name || !String(medicine_name).trim()) {
      return res.status(400).json({
        message: "Product name is required",
      });
    }

    const medicine = await Medicine.create({
      medicine_name: String(medicine_name).trim(),
      manufacturer: manufacturer ? String(manufacturer).trim() : null,
      composition: composition ? String(composition).trim() : null,
      uses: category ? String(category).trim() : null,
      side_effects: [hsn_code, gst_percent, barcode].filter((value) => value !== undefined && value !== null && value !== '').length
        ? JSON.stringify({
            hsn_code: hsn_code ? String(hsn_code).trim() : null,
            gst_percent: gst_percent !== undefined && gst_percent !== null ? Number(gst_percent) : null,
            barcode: barcode ? String(barcode).trim() : null,
          })
        : null,
    });

    res.status(201).json(medicine);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Unable to create custom product",
    });
  }
};