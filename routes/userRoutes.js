// PATH: backend/routes/userRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { OAuth2Client } from "google-auth-library";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ======================================================
   🔧 Helpers
====================================================== */
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const sanitizeUser = (userDocOrObj) => {
  if (!userDocOrObj) return userDocOrObj;

  const u =
    typeof userDocOrObj.toObject === "function"
      ? userDocOrObj.toObject()
      : { ...userDocOrObj };

  delete u.password;
  delete u.__v;
  return u;
};

const getJwtSecret = () => process.env.JWT_SECRET;

/* ======================================================
   🔐 Generate Token
====================================================== */
const generateToken = (user) => {
  const secret = getJwtSecret();
  if (!secret) {
    // ما نرميش error عام يوقع السيرفر — نخلي route تمسكه
    throw new Error("JWT_SECRET غير موجود في .env");
  }

  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    secret,
    { expiresIn: "30d" }
  );
};

/* ======================================================
   ✅ Google OAuth Client
====================================================== */
const googleClient = new OAuth2Client();

/* ======================================================
   ✅ Google Audiences
====================================================== */
const getGoogleAudiences = () => {
  const list = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID_WEB,
    process.env.GOOGLE_CLIENT_ID_ANDROID,
    process.env.GOOGLE_CLIENT_ID_IOS,
  ]
    .filter(Boolean)
    .map((x) => String(x).trim());

  if (list.length === 0) {
    throw new Error("لا يوجد GOOGLE_CLIENT_ID في .env");
  }
  return list;
};

/* ======================================================
   ✅ ROLE MAPPING
====================================================== */
const mapRole = (role) => {
  const r = String(role || "").trim().toLowerCase();
  if (r === "driver" || r === "technician") return "technician";
  if (r === "admin") return "admin";
  return "customer";
};

/* ======================================================
   ✅ REGISTER (LOCAL)
====================================================== */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "الرجاء إدخال جميع الحقول",
      });
    }

    const safeEmail = normalizeEmail(email);

    const existingUser = await User.findOne({ email: safeEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "⚠️ المستخدم موجود بالفعل",
      });
    }

    const newUser = await User.create({
      name: String(name).trim(),
      email: safeEmail,
      password, // الموديل يعمل hash
      role: mapRole(role),
      ...(phone ? { phone: String(phone).trim() } : {}),
      authProvider: "local",
    });

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: "تم التسجيل بنجاح ✅",
      token,
      user: sanitizeUser(newUser),
    });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
});

/* ======================================================
   ✅ LOGIN (LOCAL)
====================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال البريد الإلكتروني وكلمة المرور",
      });
    }

    const safeEmail = normalizeEmail(email);

    const user = await User.findOne({ email: safeEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    if (user.authProvider && user.authProvider !== "local") {
      return res.status(401).json({
        success: false,
        message: "❌ هذا الحساب مسجل عبر Google",
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "تم تسجيل الدخول بنجاح ✅",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
});

/* ======================================================
   ✅ GOOGLE LOGIN
====================================================== */
router.post("/google", async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken || String(idToken).trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "idToken مطلوب",
      });
    }

    const audiences = getGoogleAudiences();

    const ticket = await googleClient.verifyIdToken({
      idToken: String(idToken),
      audience: audiences,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(401).json({
        success: false,
        message: "Google Token غير صالح",
      });
    }

    if (payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "البريد غير موثق من Google",
      });
    }

    const email = normalizeEmail(payload.email);
    const name = payload.name || email.split("@")[0];
    const googleId = payload.sub ? String(payload.sub) : "";

    if (!googleId) {
      return res.status(401).json({
        success: false,
        message: "Google Token غير صالح",
      });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        role: mapRole(role),
        authProvider: "google",
        googleId,
        // احتياط لو في بيئات قديمة كانت بتطلب password
        password: `google_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      });
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (!user.authProvider) user.authProvider = "local";
      user.lastLogin = new Date();
      await user.save();
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: "تم تسجيل الدخول عبر Google ✅",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("❌ GOOGLE LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "خطأ أثناء تسجيل الدخول بجوجل",
    });
  }
});

/* ======================================================
   👤 CURRENT USER
====================================================== */
router.get("/me", protect, (req, res) => {
  return res.json({ success: true, user: sanitizeUser(req.user) });
});

/* ======================================================
   ✅ TEST ROUTE
====================================================== */
router.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "✅ Users route is working",
  });
});

export default router;
