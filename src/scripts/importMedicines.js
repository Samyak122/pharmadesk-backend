const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const sequelize = require("../config/database");

const medicines = [];

const csvPath = path.join(__dirname, "../../dataset/Medicine_Details.csv");

async function importMedicines() {
  try {
    console.log("🔗 Connecting to Database...");

    await sequelize.authenticate();
    console.log("✅ Database Connected");

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row) => {
        medicines.push({
          medicine_name: row["Medicine Name"] || "",
          composition: row["Composition"] || "",
          manufacturer: row["Manufacturer"] || "",
          uses: row["Uses"] || "",
          side_effects: row["Side_effects"] || "",
          image_url: row["Image URL"] || "",
          excellent_review: parseFloat(row["Excellent Review %"]) || 0,
          average_review: parseFloat(row["Average Review %"]) || 0,
          poor_review: parseFloat(row["Poor Review %"]) || 0
        });
      })
      .on("end", async () => {
        console.log(`📄 ${medicines.length} medicines found.`);

        try {
          const query = `
            INSERT INTO medicine_master
            (
              medicine_name,
              composition,
              manufacturer,
              uses,
              side_effects,
              image_url,
              excellent_review,
              average_review,
              poor_review
            )
            VALUES
            (
              :medicine_name,
              :composition,
              :manufacturer,
              :uses,
              :side_effects,
              :image_url,
              :excellent_review,
              :average_review,
              :poor_review
            );
          `;

          for (const medicine of medicines) {
            await sequelize.query(query, {
              replacements: medicine
            });
          }

          console.log("✅ Medicine Import Completed Successfully");
          console.log(`🎉 Imported ${medicines.length} medicines`);

          process.exit();

        } catch (err) {
          console.error(err);
        }
      });

  } catch (error) {
    console.error("❌ Database Connection Failed");
    console.error(error);
  }
}

importMedicines();