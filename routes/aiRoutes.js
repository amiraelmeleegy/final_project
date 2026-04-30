// PATH: backend/routes/aiRoutes.js
import express from "express";
import multer from "multer";
import { photoDiagnosis } from "../controllers/aiController.js";

const router = express.Router();

// Memory storage (هنحوّل لـ base64)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 6 * 1024 * 1024, // 6MB
  },
});

router.post("/photo-diagnosis", upload.single("image"), photoDiagnosis);

export default router;