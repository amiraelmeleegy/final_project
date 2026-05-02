// PATH: backend/config/db.js
import mongoose from "mongoose";

let listenersAttached = false;

mongoose.set("strictQuery", true);

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on("connected", () => {
    console.log("🟢 Mongoose connected");
  });

  mongoose.connection.on("disconnected", () => {
    console.log("⚠️ تم قطع الاتصال بقاعدة البيانات!");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("✅ تم إعادة الاتصال بقاعدة البيانات!");
  });

  mongoose.connection.on("error", (err) => {
    console.log("❌ DB Error:", err?.message || err);
  });
}

function maskMongoUri(uri) {
  try {
    return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
  } catch {
    return "[invalid-uri]";
  }
}

mongoose.connect(process.env.MONGO_URI)

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  attachConnectionListeners();

  if (mongoose.connection.readyState === 1) {
    console.log("ℹ️ MongoDB is already connected");
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    console.log("⏳ MongoDB connection is already in progress...");
    return mongoose.connection;
  }

  const options = {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    retryWrites: true,
  };

  try {
    const conn = await mongoose.connect(uri, options);

    console.log("====================================");
    console.log("✅ متصل بقاعدة البيانات بنجاح");
    console.log(`📦 اسم قاعدة البيانات: ${conn.connection.name}`);
    console.log(`🌍 المضيف: ${conn.connection.host}`);
    console.log(
      `🔌 الحالة: ${conn.connection.readyState === 1 ? "connected" : "unknown"}`
    );
    console.log("====================================");

    return conn;
  } catch (err) {
    const msg = err?.message || String(err);

    console.log("====================================");
    console.log("❌ فشل الاتصال بقاعدة البيانات");
    console.log(`🧾 السبب: ${msg}`);
    console.log(`🔎 URI: ${maskMongoUri(uri)}`);

    if (
      msg.includes("whitelist") ||
      msg.includes("IP") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("querySrv") ||
      msg.includes("Could not connect to any servers") ||
      msg.includes("Server selection timed out") ||
      msg.includes("connection timed out") ||
      msg.includes("MongoServerSelectionError")
    ) {
      console.log("💡 افحص الآتي:");
      console.log("1) أضف IP الحالي في MongoDB Atlas > Network Access");
      console.log("2) تأكد أن Cluster شغال");
      console.log("3) تأكد أن MONGO_URI صحيح");
      console.log("4) تأكد أن الإنترنت أو DNS شغالين بشكل طبيعي");
    }

    if (
      msg.includes("bad auth") ||
      msg.includes("Authentication failed") ||
      msg.includes("auth failed") ||
      msg.includes("auth")
    ) {
      console.log("💡 يبدو أن هناك مشكلة في اسم المستخدم أو كلمة المرور في MONGO_URI");
    }

    console.log("====================================");

    throw err;
  }
};

export default connectDB;
