import express from "express";
import Accident from "../models/accidentModel.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const accident = await Accident.create(req.body);

    res.json({
      success: true,
      message: "🚨 Accident saved successfully",
      data: accident,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "❌ Error saving accident",
      error: error.message,
    });
  }
});

export default router;
