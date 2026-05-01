// PATH: backend/server.js
import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import connectDB from "./config/db.js";

import userRoutes from "./routes/userRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import technicianRoutes from "./routes/technicianRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import accidentRoutes from "./routes/accidentRoutes.js";
import carTypesRoutes from "./routes/carTypes.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import supportChatRoutes from "./routes/supportChatRoutes.js";
import centerRoutes from "./routes/centerRoutes.js";
import orderEstimateRoutes from "./routes/orderEstimate.routes.js";
import mapsRoutes from "./routes/maps.routes.js";
import aiRoutes from "./routes/aiRoutes.js";

import { attachSupportChatSocket } from "./socket/supportChatSocket.js";
import Order from "./models/orderModel.js";
import Center from "./models/centerModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const server = http.createServer(app);

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 5555);
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const HOST = process.env.HOST || "0.0.0.0";
const ORDER_TIMEOUT_SEC = Number(process.env.ORDER_TIMEOUT_SEC || 60);
const BODY_LIMIT = process.env.BODY_LIMIT || "2mb";
const SOCKET_PATH = process.env.SOCKET_PATH || "/socket.io";

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.set("trust proxy", 1);

mongoose.set("autoIndex", !IS_PROD);
mongoose.set("bufferCommands", false);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (!IS_PROD) return true;
  if (CORS_ORIGINS.length === 0) return true;
  return CORS_ORIGINS.includes(origin);
}

function normalizeDoc(doc) {
  return doc?.toObject ? doc.toObject() : doc;
}

function getId(value) {
  if (!value) return "";
  return String(value?._id || value);
}

function getOrderUserId(order) {
  return getId(order?.user);
}

function getOrderTechnicianId(order) {
  return getId(order?.technician?.techId || order?.technician);
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(String(id));
}

function isTerminalOrderStatus(status) {
  return ["completed", "canceled"].includes(String(status || ""));
}

function isTimeoutProtectedStatus(status) {
  return [
    "assigned",
    "accepted",
    "in_progress",
    "completed",
    "canceled",
    "timeout",
  ].includes(String(status || ""));
}

function emitOrderUpdated(order, options = {}) {
  const payload = normalizeDoc(order);
  if (!payload) return;

  const orderId = getId(payload._id);
  const userId = getOrderUserId(payload);
  const technicianId = getOrderTechnicianId(payload);
  const message = options.message || "تم تحديث الطلب";

  io.to("centers").emit("order:updated", payload);

  if (orderId) {
    io.to(orderId).emit("order:updated", payload);
    io.to(orderId).emit("orderStatusUpdated", {
      orderId,
      status: payload.status,
      technicianId: technicianId || undefined,
      message,
    });
  }

  if (userId) {
    io.to(`user:${userId}`).emit("order:updated", payload);
    io.to(`user:${userId}`).emit("orderStatusUpdated", {
      orderId,
      status: payload.status,
      technicianId: technicianId || undefined,
      message,
    });
  }

  if (technicianId) {
    io.to(`technician:${technicianId}`).emit("order:assigned", payload);
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
  })
);

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

if (!IS_PROD) {
  console.log("GOOGLE WEB KEY LOADED:", !!process.env.GOOGLE_MAPS_API_KEY);
  console.log("GOOGLE SERVER KEY LOADED:", !!process.env.GOOGLE_SERVER_MAPS_KEY);

  app.use((req, res, next) => {
    const startedAt = Date.now();

    console.log(
      "➡️",
      req.method,
      req.originalUrl,
      "| origin:",
      req.headers.origin || "N/A"
    );

    res.on("finish", () => {
      console.log(
        "⬅️",
        req.method,
        req.originalUrl,
        "| status:",
        res.statusCode,
        "|",
        `${Date.now() - startedAt}ms`
      );
    });

    next();
  });
}

export const io = new Server(server, {
  path: SOCKET_PATH,
  cors: {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error(`Socket CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 20000,
  pingInterval: 25000,
});

export const onlineTechnicians = new Map();
export const onlineCenters = new Map();

const orderTimeoutTimers = new Map();

function clearOrderTimeout(orderId) {
  const key = String(orderId);
  const old = orderTimeoutTimers.get(key);
  if (old) clearTimeout(old);
  orderTimeoutTimers.delete(key);
}

function scheduleOrderTimeout(orderId, userId) {
  if (!orderId) return;

  clearOrderTimeout(orderId);

  const timer = setTimeout(async () => {
    try {
      if (mongoose.connection?.readyState !== 1) return;

      const order = await Order.findById(orderId);
      if (!order) return;

      const status = String(order.status || "");

      if (isTimeoutProtectedStatus(status)) {
        return;
      }

      order.status = "timeout";
      await order.save();

      const payload = {
        orderId: String(orderId),
        status: "timeout",
        message: "لم يتم العثور على فني الآن",
      };

      io.to(String(orderId)).emit("orderStatusUpdated", payload);
      io.to("centers").emit("order:updated", normalizeDoc(order));

      if (userId) {
        io.to(`user:${String(userId)}`).emit("order:timeout", payload);
        io.to(`user:${String(userId)}`).emit("orderStatusUpdated", payload);
      }

      console.log(`⏱️ Order timeout: ${orderId}`);
    } catch (error) {
      console.error("❌ timeout handler:", error?.message || error);
    } finally {
      clearOrderTimeout(orderId);
    }
  }, ORDER_TIMEOUT_SEC * 1000);

  orderTimeoutTimers.set(String(orderId), timer);
}

app.get("/", (req, res) => {
  res.status(200).send("🚗 Doctor Car Backend يعمل بنجاح ✅");
});

app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection?.readyState ?? 0;

  res.json({
    ok: true,
    message: "API is healthy ✅",
    port: PORT,
    host: HOST,
    db: {
      readyState: dbState,
      connected: dbState === 1,
      name: mongoose.connection?.name || null,
      host: mongoose.connection?.host || null,
    },
    env: process.env.NODE_ENV || "development",
    socketPath: SOCKET_PATH,
    bestLocalIP: getBestLocalIP(),
    allLocalIPs: getAllLocalIPv4(),
    onlineTechnicians: onlineTechnicians.size,
    onlineCenters: onlineCenters.size,
    uptimeSec: Math.round(process.uptime()),
    now: new Date().toISOString(),
  });
});

app.get("/api/debug/network", (req, res) => {
  const localIP = getBestLocalIP();

  res.json({
    ok: true,
    host: HOST,
    port: PORT,
    localIP,
    allIPs: getAllLocalIPv4(),
    urlFromSameWifi: `http://${localIP}:${PORT}`,
    healthUrl: `http://${localIP}:${PORT}/api/health`,
    socketUrl: `http://${localIP}:${PORT}`,
    note: "لو بتجرب من Android Emulator استخدم 10.0.2.2 بدل localhost",
  });
});

app.get("/api/debug/socket", (req, res) => {
  res.json({
    ok: true,
    socketPath: SOCKET_PATH,
    transports: ["websocket", "polling"],
    onlineTechnicians: onlineTechnicians.size,
    onlineCenters: onlineCenters.size,
  });
});

function dbReadyGuard(req, res, next) {
  const openPaths = new Set([
    "/",
    "/api/health",
    "/api/debug/network",
    "/api/debug/socket",
  ]);

  if (!IS_PROD) {
    openPaths.add("/api/test/fake-order");
  }

  if (openPaths.has(req.path) || req.path.startsWith(SOCKET_PATH)) {
    return next();
  }

  if (mongoose.connection?.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: "Database not connected",
      code: "DB_UNAVAILABLE",
    });
  }

  return next();
}

app.use(dbReadyGuard);

app.use((req, res, next) => {
  req.io = io;

  req.emitOrderToCenters = (order, centerId = null) => {
    const payload = normalizeDoc(order);
    if (!payload) return;

    if (centerId) {
      io.to(`center:${String(centerId)}`).emit("order:new", payload);
    } else {
      io.to("centers").emit("order:new", payload);
    }
  };

  next();
});

app.use("/api/users", userRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/technicians", technicianRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/maps", mapsRoutes);

app.use("/api/orders", (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    try {
      const isCreateOrderRequest =
        req.method === "POST" &&
        req.baseUrl === "/api/orders" &&
        (req.path === "/" || req.path === "");

      if (isCreateOrderRequest && res.statusCode === 201 && body?.order?._id) {
        const orderId = String(body.order._id);
        const userId = getOrderUserId(body.order);

        scheduleOrderTimeout(orderId, userId);

        const centerId = getId(body.order.center);

        if (centerId) {
          io.to(`center:${centerId}`).emit("order:new", body.order);
        } else {
          io.to("centers").emit("order:new", body.order);
        }

        console.log(`📦 New order sent to center dashboard: ${orderId}`);
      }
    } catch (error) {
      console.warn("⚠️ order hook failed:", error?.message || error);
    }

    return originalJson(body);
  };

  next();
});

app.use("/api/orders", orderRoutes);
app.use("/api/orders", orderEstimateRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/accidents", accidentRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/car-types", carTypesRoutes);
app.use("/api/support", supportChatRoutes);
app.use("/api/centers", centerRoutes);

if (!IS_PROD) {
  app.post("/api/test/fake-order", (req, res) => {
    const fakeOrder = {
      _id: `ORDER_TEST_${Date.now()}`,
      userName: "محمد إبراهيم",
      serviceType: "battery",
      distance: 3,
      chatId: "CHAT_TEST_123",
      status: "pending",
      createdAt: new Date().toISOString(),
      customerLocation: {
        lat: 30.0444,
        lng: 31.2357,
      },
    };

    io.to("centers").emit("order:new", fakeOrder);

    console.log("🧪 Fake order emitted to centers:", fakeOrder);

    return res.json({
      ok: true,
      sentTo: "centers",
      order: fakeOrder,
    });
  });
}

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  try {
    attachSupportChatSocket(io, socket);
    console.log("💬 Support chat attached:", socket.id);
  } catch (error) {
    console.warn("⚠️ supportChat attach error:", error?.message || error);
  }

  socket.on("user:online", (payload = {}) => {
    const { userId } = payload;
    if (!userId) return;

    socket.join(`user:${String(userId)}`);

    socket.emit("user:online:ok", {
      userId: String(userId),
      socketId: socket.id,
    });

    console.log(`👤 user online: ${userId} -> ${socket.id}`);
  });

  socket.on("center:online", (payload = {}) => {
    const { centerId } = payload;
    if (!centerId) return;

    const cId = String(centerId);

    onlineCenters.set(cId, socket.id);

    socket.join("centers");
    socket.join(`center:${cId}`);

    socket.emit("center:online:ok", {
      centerId: cId,
      socketId: socket.id,
      onlineCenters: onlineCenters.size,
    });

    console.log(`🏢 center online: ${cId} -> ${socket.id}`);
  });

  socket.on("technician:online", (payload = {}) => {
    const { technicianId } = payload;
    if (!technicianId) return;

    const techId = String(technicianId);

    onlineTechnicians.set(techId, socket.id);

    socket.join("technicians");
    socket.join(`technician:${techId}`);

    socket.emit("technician:online:ok", {
      technicianId: techId,
      socketId: socket.id,
      onlineCount: onlineTechnicians.size,
    });

    console.log(`🛠️ technician online: ${techId} -> ${socket.id}`);
  });

  socket.on("joinOrderRoom", (payload = {}) => {
    const orderId =
      typeof payload === "string" ? payload : payload?.orderId || payload?._id;

    if (!orderId) return;

    socket.join(String(orderId));

    socket.emit("joinOrderRoom:ok", {
      orderId: String(orderId),
      socketId: socket.id,
    });

    console.log(`📦 joined order room: ${String(orderId)} -> ${socket.id}`);
  });

  socket.on("leaveOrderRoom", (payload = {}) => {
    const orderId =
      typeof payload === "string" ? payload : payload?.orderId || payload?._id;

    if (!orderId) return;

    socket.leave(String(orderId));

    socket.emit("leaveOrderRoom:ok", {
      orderId: String(orderId),
      socketId: socket.id,
    });

    console.log(`📦 left order room: ${String(orderId)} -> ${socket.id}`);
  });

  socket.on("center:assign-technician", async (payload = {}) => {
    const orderId = getId(payload.orderId);
    const technicianId = getId(payload.technicianId);
    const centerId = getId(payload.centerId);

    if (!orderId || !technicianId) {
      socket.emit("center:assign-technician:failed", {
        orderId: orderId || null,
        reason: "orderId and technicianId are required",
      });
      return;
    }

    if (String(orderId).startsWith("ORDER_TEST_")) {
      const fakeUpdatedOrder = {
        _id: String(orderId),
        userName: "محمد إبراهيم",
        serviceType: "battery",
        distance: 3,
        chatId: "CHAT_TEST_123",
        status: "assigned",
        createdAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        center: centerId || "center1",
        technician: {
          techId: String(technicianId),
        },
        customerLocation: {
          lat: 30.0444,
          lng: 31.2357,
        },
      };

      socket.emit("center:assign-technician:ok", fakeUpdatedOrder);
      io.to("centers").emit("order:updated", fakeUpdatedOrder);

      io.to(`technician:${String(technicianId)}`).emit(
        "order:assigned",
        fakeUpdatedOrder
      );

      io.to(String(orderId)).emit("orderStatusUpdated", {
        orderId: String(orderId),
        status: "assigned",
        technicianId: String(technicianId),
        message: "تم تعيين فني تجربة",
      });

      console.log(`🧪 Fake order ${orderId} assigned to ${technicianId}`);
      return;
    }

    try {
      if (mongoose.connection?.readyState !== 1) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Database not connected",
        });
        return;
      }

      if (!isValidObjectId(orderId)) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Invalid order id",
        });
        return;
      }

      const currentOrder = await Order.findById(orderId);

      if (!currentOrder) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Order not found",
        });
        return;
      }

      const currentStatus = String(currentOrder.status || "");

      if (isTerminalOrderStatus(currentStatus)) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "لا يمكن تعيين فني لطلب مكتمل أو ملغي",
        });
        return;
      }

      const updatePayload = {
        status: "assigned",
        acceptedAt: currentOrder.acceptedAt || new Date(),

        ...(centerId && isValidObjectId(centerId)
          ? { center: String(centerId) }
          : {}),

        ...(isValidObjectId(technicianId)
          ? { "technician.techId": String(technicianId) }
          : { "technician.techName": String(technicianId) }),
      };

      const updated = await Order.findByIdAndUpdate(
        orderId,
        { $set: updatePayload },
        { new: true }
      );

      if (!updated) {
        socket.emit("center:assign-technician:failed", {
          orderId: String(orderId),
          reason: "Failed to update order",
        });
        return;
      }

      clearOrderTimeout(orderId);

      const order = normalizeDoc(updated);

      const message =
        currentStatus === "assigned"
          ? "تم تغيير الفني بواسطة المركز"
          : "تم تعيين فني من المركز";

      socket.emit("center:assign-technician:ok", order);
      emitOrderUpdated(order, { message });

      console.log(
        `🏢 Center assigned/changed order ${orderId} to technician ${technicianId}`
      );
    } catch (error) {
      console.error("❌ center:assign-technician:", error?.message || error);

      socket.emit("center:assign-technician:failed", {
        orderId: String(orderId),
        reason: error?.message || "Server error",
      });
    }
  });

  socket.on("technician:location:update", async (payload = {}) => {
    try {
      const technicianId = payload.technicianId
        ? String(payload.technicianId)
        : null;

      const orderId = payload.orderId ? String(payload.orderId) : null;

      const rawLoc = payload.location || {};
      const lat = Number(rawLoc.lat ?? payload.lat);
      const lng = Number(rawLoc.lng ?? payload.lng);

      const heading =
        rawLoc.heading != null
          ? Number(rawLoc.heading)
          : payload.heading != null
            ? Number(payload.heading)
            : null;

      const speed =
        rawLoc.speed != null
          ? Number(rawLoc.speed)
          : payload.speed != null
            ? Number(payload.speed)
            : null;

      if (!technicianId || !orderId) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const locationPayload = {
        orderId,
        technicianId,
        location: {
          lat,
          lng,
          ...(heading != null && Number.isFinite(heading) ? { heading } : {}),
          ...(speed != null && Number.isFinite(speed) ? { speed } : {}),
        },
        ...(heading != null && Number.isFinite(heading) ? { heading } : {}),
        ...(speed != null && Number.isFinite(speed) ? { speed } : {}),
        ts: payload.ts || new Date().toISOString(),
      };

      socket.emit("technician:location:ack", {
        ok: true,
        orderId,
        technicianId,
        ts: new Date().toISOString(),
      });

      socket.to(orderId).emit("technicianLocationUpdate", locationPayload);
      socket.to(orderId).emit("technician:location:updated", locationPayload);
      io.to("centers").emit("technicianLocationUpdate", locationPayload);

      if (
        mongoose.connection?.readyState === 1 &&
        mongoose.Types.ObjectId.isValid(orderId)
      ) {
        await Order.findByIdAndUpdate(
          orderId,
          {
            $set: {
              "tracking.lastTechnicianLocation": {
                lat,
                lng,
                ...(heading != null && Number.isFinite(heading)
                  ? { heading }
                  : {}),
                ...(speed != null && Number.isFinite(speed) ? { speed } : {}),
                updatedAt: new Date(),
              },
            },
          },
          { new: false }
        );
      }

      console.log(
        `📍 technician live location -> order ${orderId} | tech ${technicianId} | ${lat}, ${lng}`
      );
    } catch (error) {
      console.error("❌ technician:location:update:", error?.message || error);
    }
  });

  socket.on("order:cancel", async (payload = {}) => {
    const { orderId, userId } = payload;
    if (!orderId) return;

    try {
      if (mongoose.connection?.readyState !== 1) {
        socket.emit("order:cancel:failed", {
          orderId,
          reason: "Database not connected",
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
        socket.emit("order:cancel:failed", {
          orderId,
          reason: "Invalid order id",
        });
        return;
      }

      const order = await Order.findById(orderId);

      if (!order) {
        socket.emit("order:cancel:failed", {
          orderId,
          reason: "Order not found",
        });
        return;
      }

      const status = String(order.status || "");

      if (
        ["assigned", "accepted", "in_progress", "completed"].includes(status)
      ) {
        socket.emit("order:cancel:failed", {
          orderId,
          reason: "Order cannot be canceled in current status",
        });
        return;
      }

      order.status = "canceled";
      await order.save();

      clearOrderTimeout(orderId);

      const payloadOut = {
        orderId: String(orderId),
        status: "canceled",
        message: "تم إلغاء الطلب",
      };

      io.to(String(orderId)).emit("orderStatusUpdated", payloadOut);
      io.to("centers").emit("order:updated", normalizeDoc(order));

      const uid = userId || getOrderUserId(order);

      if (uid) {
        io.to(`user:${String(uid)}`).emit("order:canceled", payloadOut);
        io.to(`user:${String(uid)}`).emit("orderStatusUpdated", payloadOut);
      }

      console.log(`🛑 Order canceled: ${orderId}`);
    } catch (error) {
      console.error("❌ order:cancel:", error?.message || error);

      socket.emit("order:cancel:failed", {
        orderId,
        reason: "Server error",
      });
    }
  });

  socket.on("order:accept", async (payload = {}) => {
    const { orderId, technicianId } = payload;
    if (!orderId || !technicianId) return;

    try {
      if (mongoose.connection?.readyState !== 1) {
        socket.emit("order:accept:failed", {
          orderId,
          reason: "Database not connected",
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(String(orderId))) {
        socket.emit("order:accept:failed", {
          orderId,
          reason: "Invalid order id",
        });
        return;
      }

      const updated = await Order.findOneAndUpdate(
        {
          _id: orderId,
          status: { $in: ["pending", "searching", "contacting"] },
        },
        {
          $set: {
            status: "assigned",
            acceptedAt: new Date(),
            "technician.techId": String(technicianId),
          },
        },
        { new: true }
      );

      if (!updated) {
        socket.emit("order:accept:failed", {
          orderId,
          reason: "Order already taken / not pending",
        });
        return;
      }

      clearOrderTimeout(orderId);

      const order = normalizeDoc(updated);
      const userId = getOrderUserId(order);

      socket.emit("order:accepted", order);
      io.to("centers").emit("order:updated", order);

      if (userId) {
        io.to(`user:${String(userId)}`).emit("order:accepted", order);
        io.to(`user:${String(userId)}`).emit("orderStatusUpdated", {
          orderId: String(orderId),
          status: "assigned",
          message: "تم العثور على فني",
          technicianId: String(technicianId),
        });
      }

      io.to(String(orderId)).emit("orderStatusUpdated", {
        orderId: String(orderId),
        status: "assigned",
        message: "تم العثور على فني",
        technicianId: String(technicianId),
      });

      console.log(`✅ Order assigned: ${orderId} by tech ${technicianId}`);
    } catch (error) {
      console.error("❌ order:accept:", error?.message || error);

      socket.emit("order:accept:failed", {
        orderId,
        reason: "Server error",
      });
    }
  });

  socket.on("order:reject", (payload = {}) => {
    const { orderId, technicianId } = payload;
    if (!orderId || !technicianId) return;

    console.log(`❌ Order rejected: ${orderId} by tech ${technicianId}`);
  });

  socket.on("disconnect", (reason) => {
    for (const [techId, socketId] of onlineTechnicians.entries()) {
      if (socketId === socket.id) {
        onlineTechnicians.delete(techId);
        console.log(`🛑 technician offline: ${techId}`);
        break;
      }
    }

    for (const [centerId, socketId] of onlineCenters.entries()) {
      if (socketId === socket.id) {
        onlineCenters.delete(centerId);
        console.log(`🏢 center offline: ${centerId}`);
        break;
      }
    }

    console.log("🔴 Socket disconnected:", socket.id, "| reason:", reason);
  });
});

app.post("/api/orders/:id/start-timeout", async (req, res) => {
  try {
    if (mongoose.connection?.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database not connected",
        code: "DB_UNAVAILABLE",
      });
    }

    const orderId = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const userId = getOrderUserId(order);
    scheduleOrderTimeout(orderId, userId);

    return res.json({
      success: true,
      orderId,
      timeoutSec: ORDER_TIMEOUT_SEC,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Server error",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, req, res, next) => {
  console.error("🔥 Unhandled error:", err);

  res.status(err?.status || err?.statusCode || 500).json({
    success: false,
    message: err?.message || "Server error",
  });
});

function getAllLocalIPv4() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push({
          name,
          address: iface.address,
          netmask: iface.netmask,
        });
      }
    }
  }

  return ips;
}

function getBestLocalIP() {
  const all = getAllLocalIPv4();

  const wifiLike = all.find(
    (i) =>
      /wi-?fi|wireless|wlan/i.test(i.name) ||
      i.address.startsWith("192.168.") ||
      i.address.startsWith("10.")
  );

  if (wifiLike) return wifiLike.address;

  const nonHyperV = all.find(
    (i) => !/vEthernet|Hyper-V|VMware|VirtualBox|Default Switch/i.test(i.name)
  );

  if (nonHyperV) return nonHyperV.address;

  return all[0]?.address || "localhost";
}

async function startServer() {
  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use.`);
      process.exit(1);
    }

    console.error("❌ Server error:", err?.message || err);
    process.exit(1);
  });

  try {
    await connectDB();
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("⚠️ DB connect failed:", error?.message || error);
    if (IS_PROD) process.exit(1);
  }

  if (mongoose.connection?.readyState === 1) {
    try {
      await Center.syncIndexes();
      console.log("✅ Center indexes synced");
    } catch (error) {
      console.warn("⚠️ Center index sync failed:", error?.message || error);
    }
  }

  server.listen(PORT, HOST, () => {
    const localIP = getBestLocalIP();

    console.log("====================================");
    console.log("🚀 Doctor Car Backend Running ✅");
    console.log(`🌍 Port: ${PORT}`);
    console.log(`🧷 Bound: http://${HOST}:${PORT}`);
    console.log(`📱 Network: http://${localIP}:${PORT}`);
    console.log(`❤️ Health: http://${localIP}:${PORT}/api/health`);
    console.log(`🔌 Socket: http://${localIP}:${PORT}${SOCKET_PATH}`);
    console.log(`⏱️ Order Timeout: ${ORDER_TIMEOUT_SEC}s`);
    console.log("====================================");
  });
}

startServer().catch((error) => {
  console.error("❌ Startup failed:", error?.message || error);
  if (IS_PROD) process.exit(1);
});

async function gracefulShutdown(signal) {
  console.log(`🧹 Graceful shutdown... (${signal})`);

  try {
    for (const timer of orderTimeoutTimers.values()) clearTimeout(timer);
    orderTimeoutTimers.clear();
  } catch {}

  try {
    io.close();
  } catch {}

  try {
    await mongoose.connection.close();
  } catch {}

  try {
    server.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
