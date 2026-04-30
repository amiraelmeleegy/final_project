import express from "express";
import {
  registerCustomer,
  loginCustomer,
  registerTechnician,
  loginTechnician,
} from "../controllers/auth.controller.js";

const router = express.Router();

// 👤 Customer
router.post("/register", registerCustomer);
router.post("/login", loginCustomer);

// 🔧 Technician
router.post("/technician/register", registerTechnician);
router.post("/technician/login", loginTechnician);

export default router;
