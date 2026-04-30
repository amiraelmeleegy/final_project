// PATH: backend/controllers/userController.js
import User from "../models/userModel.js";
import jwt from "jsonwebtoken";

// helper: generate JWT
const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET غير موجود في env");
  }

  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

// helper: normalize email
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

/* ======================================================
   ✅ REGISTER
====================================================== */
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "الرجاء إدخال الاسم والبريد وكلمة المرور",
      });
    }

    const safeEmail = normalizeEmail(email);

    const existing = await User.findOne({ email: safeEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "⚠️ البريد موجود بالفعل",
      });
    }

    // ✅ لا تعمل hash هنا — الموديل يعملها في pre-save
    const user = await User.create({
      name: String(name).trim(),
      email: safeEmail,
      password,
      role,
      ...(phone ? { phone: String(phone).trim() } : {}),
      authProvider: "local",
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "تم التسجيل بنجاح ✅",
      token,
      user, // password محذوف تلقائيًا (select:false + toJSON transform)
    });
  } catch (err) {
    console.error("❌ registerUser:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
};

/* ======================================================
   ✅ LOGIN
====================================================== */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "يرجى إدخال البريد الإلكتروني وكلمة المرور",
      });
    }

    const safeEmail = normalizeEmail(email);

    // ✅ لازم نختار password لأن select:false في الموديل
    const user = await User.findOne({ email: safeEmail }).select("+password");

    // رسالة موحدة (حماية)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    // ✅ منع local login لو الحساب Google (لو بتستخدم authProvider)
    if (user.authProvider && user.authProvider !== "local") {
      return res.status(401).json({
        success: false,
        message: "❌ هذا الحساب مسجل عبر Google",
      });
    }

    const valid = await user.matchPassword(password);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "❌ بيانات الدخول غير صحيحة",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    // لا ترجع كلمة السر
    user.password = undefined;

    return res.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح ✅",
      token,
      user,
    });
  } catch (err) {
    console.error("❌ loginUser:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
};

/* ======================================================
   ✅ GET PROFILE (Protected)
   - يفترض middleware حاطط req.user
====================================================== */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "غير مصرح",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "المستخدم غير موجود",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("❌ getProfile:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "حدث خطأ في الخادم",
    });
  }
};
