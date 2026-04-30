import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useJsApiLoader } from "@react-google-maps/api";
import "./App.css";
import { API_URL, CENTER_ID } from "./config";
import { socket } from "./socket";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import OrdersPanel from "./components/OrdersPanel";
import TrackingMap from "./components/TrackingMap";
import TrackingInfo from "./components/TrackingInfo";
import LogsPanel from "./components/LogsPanel";
import FullTracking from "./components/FullTracking";

import {
  assignedTech,
  canAssign,
  customerName,
  locationListenEvents,
  orderId,
  orderStatus,
  serviceName,
  shortId,
  upsertOrder,
  waitingStatuses,
} from "./utils/orderHelpers";

import {
  distanceMeters,
  etaMinutes,
  getCustomerLocation,
  getLocationFromPayload,
  joinOrderRoom,
} from "./utils/trackingHelpers";

export default function App() {
  const mapRef = useRef(null);
  const fullMapRef = useRef(null);
  const moveTimerRef = useRef(null);
  const ordersRef = useRef([]);
  const technicianLocationsRef = useRef({});
  const technicianIdRef = useRef("tech1");

  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [technicianId, setTechnicianId] = useState("tech1");
  const [logs, setLogs] = useState([]);
  const [technicianLocations, setTechnicianLocations] = useState({});
  const [assigningId, setAssigningId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [trackingFullScreen, setTrackingFullScreen] = useState(false);
  const [autoMove, setAutoMove] = useState(false);

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
  });

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    technicianLocationsRef.current = technicianLocations;
  }, [technicianLocations]);

  useEffect(() => {
    technicianIdRef.current = technicianId;
  }, [technicianId]);

  const selectedOrder = useMemo(() => {
    return orders.find((o) => orderId(o) === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  const customerLocation = useMemo(() => {
    return getCustomerLocation(selectedOrder);
  }, [selectedOrder]);

  const technicianLocation = selectedOrder
    ? technicianLocations[orderId(selectedOrder)]
    : null;

  const mapCenter = technicianLocation || customerLocation;

  const currentEta = technicianLocation
    ? etaMinutes(customerLocation, technicianLocation)
    : "-";

  const currentDistanceKm = technicianLocation
    ? (distanceMeters(customerLocation, technicianLocation) / 1000).toFixed(2)
    : "-";

  const stats = useMemo(() => {
    return {
      total: orders.length,
      waiting: orders.filter((o) => waitingStatuses.includes(orderStatus(o))).length,
      assigned: orders.filter((o) =>
        ["assigned", "accepted", "on_the_way", "arrived"].includes(orderStatus(o))
      ).length,
      live: Object.keys(technicianLocations).length,
    };
  }, [orders, technicianLocations]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders.filter((o) => {
      const st = orderStatus(o);

      const matchesFilter =
        filter === "all" ||
        (filter === "waiting" && waitingStatuses.includes(st)) ||
        filter === st;

      const matchesQuery =
        !q ||
        orderId(o).toLowerCase().includes(q) ||
        serviceName(o).toLowerCase().includes(q) ||
        customerName(o).toLowerCase().includes(q) ||
        assignedTech(o).toLowerCase().includes(q);

      return matchesFilter && matchesQuery;
    });
  }, [orders, filter, query]);

  function addLog(text) {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString("ar-EG"),
        text,
      },
      ...prev,
    ]);
  }

  function showToast(message, type = "success") {
    setToast({ message, type });

    window.clearTimeout(window.__doctorCarToastTimer);
    window.__doctorCarToastTimer = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  }

  function focusTracking(order) {
    const id = orderId(order);
    if (!id) return;

    joinOrderRoom(id);
    setSelectedOrderId(id);
    setTrackingFullScreen(true);
    addLog(`تم فتح التتبع المباشر للطلب ${shortId(id)}`);
  }

  function fitMap(map, customer, tech) {
    if (!map || !customer || !tech || !window.google) return;

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend(customer);
    bounds.extend(tech);
    map.fitBounds(bounds, 90);
  }

  useEffect(() => {
    if (technicianLocation && customerLocation) {
      fitMap(mapRef.current, customerLocation, technicianLocation);
      fitMap(fullMapRef.current, customerLocation, technicianLocation);
    }
  }, [technicianLocation, customerLocation]);

  useEffect(() => {
    const onConnect = () => {
      setConnected(true);
      addLog("تم الاتصال بالسيرفر");

      socket.emit("center:join", { centerId: CENTER_ID });
      socket.emit("center:online", { centerId: CENTER_ID });

      for (const order of ordersRef.current) {
        const id = orderId(order);
        if (id) joinOrderRoom(id);
      }
    };

    const onDisconnect = (reason) => {
      setConnected(false);
      addLog(`تم فصل الاتصال: ${reason || ""}`);
    };

    const onCenterOk = (data) => {
      addLog(`المركز Online: ${data?.centerId || CENTER_ID}`);
    };

    const onNewOrder = (order) => {
      const id = orderId(order);
      if (!id) return;

      setOrders((prev) => upsertOrder(prev, order));
      setSelectedOrderId(id);
      joinOrderRoom(id);

      addLog(`وصل طلب جديد: ${shortId(id)}`);
      showToast("وصل طلب جديد", "success");
    };

    const onOrderUpdated = (order) => {
      const id = orderId(order);
      if (!id) return;

      setOrders((prev) => upsertOrder(prev, order));
      joinOrderRoom(id);
      addLog(`تم تحديث الطلب: ${shortId(id)}`);
    };

    const onAssignOk = (order) => {
      const id = orderId(order);

      setAssigningId(null);
      setOrders((prev) => upsertOrder(prev, order));
      setSelectedOrderId(id);
      joinOrderRoom(id);

      addLog(`تم تعيين الفني بنجاح: ${shortId(id)}`);
      showToast("تم تعيين الفني بنجاح", "success");
    };

    const onAssignFailed = (data) => {
      setAssigningId(null);
      const msg = data?.reason || data?.message || "فشل تعيين الفني";
      addLog(`فشل تعيين الفني: ${msg}`);
      showToast(msg, "danger");
    };

    const onOrderStatus = (data) => {
      const id = String(data?.orderId || data?._id || "");
      if (!id) return;

      setOrders((prev) =>
        prev.map((o) =>
          orderId(o) === id
            ? {
                ...o,
                status: data?.status || orderStatus(o),
                technicianId: data?.technicianId || o?.technicianId,
                chatId: data?.chatId || o?.chatId,
              }
            : o
        )
      );

      joinOrderRoom(id);
      addLog(`تحديث حالة الطلب ${shortId(id)}: ${data?.status || "-"}`);
    };

    const onTechLocation = (data) => {
      const parsed = getLocationFromPayload(data);
      if (!parsed) return;

      setTechnicianLocations((prev) => ({
        ...prev,
        [parsed.id]: {
          lat: parsed.lat,
          lng: parsed.lng,
          bearing: parsed.bearing,
          speed: parsed.speed,
          at: Date.now(),
        },
      }));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("center:online:ok", onCenterOk);
    socket.on("order:new", onNewOrder);
    socket.on("order:updated", onOrderUpdated);
    socket.on("center:assign-technician:ok", onAssignOk);
    socket.on("center:assign-technician:failed", onAssignFailed);
    socket.on("order:status", onOrderStatus);
    socket.on("orderStatusUpdated", onOrderStatus);
    socket.on("order:accepted", onOrderUpdated);
    socket.on("order:arrived", onOrderStatus);
    socket.on("order:cancelled", onOrderStatus);
    socket.on("order:canceled", onOrderStatus);

    for (const event of locationListenEvents) {
      socket.on(event, onTechLocation);
    }

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("center:online:ok", onCenterOk);
      socket.off("order:new", onNewOrder);
      socket.off("order:updated", onOrderUpdated);
      socket.off("center:assign-technician:ok", onAssignOk);
      socket.off("center:assign-technician:failed", onAssignFailed);
      socket.off("order:status", onOrderStatus);
      socket.off("orderStatusUpdated", onOrderStatus);
      socket.off("order:accepted", onOrderUpdated);
      socket.off("order:arrived", onOrderStatus);
      socket.off("order:cancelled", onOrderStatus);
      socket.off("order:canceled", onOrderStatus);

      for (const event of locationListenEvents) {
        socket.off(event, onTechLocation);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoMove || !selectedOrder) {
      if (moveTimerRef.current) {
        window.clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
      return;
    }

    moveTimerRef.current = window.setInterval(() => {
      sendTestTechnicianLocation(selectedOrder, false);
    }, 1200);

    return () => {
      if (moveTimerRef.current) {
        window.clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
    };
  }, [autoMove, selectedOrder, technicianId]);

  async function createFakeOrder() {
    try {
      const res = await axios.post(`${API_URL}/api/test/fake-order`);
      const id = orderId(res.data?.order);

      addLog(`تم إنشاء طلب تجربة: ${shortId(id)}`);
      showToast("تم إنشاء طلب تجربة", "success");
    } catch {
      addLog("فشل إنشاء طلب تجربة");
      showToast("تأكد أن السيرفر شغال على port 5555", "danger");
    }
  }

  function assignTechnician(order) {
    const id = orderId(order);

    if (!technicianId.trim()) {
      showToast("اكتب ID الفني الحقيقي من تطبيق الفني", "danger");
      return;
    }

    if (!canAssign(order)) {
      showToast("لا يمكن تعيين فني لطلب مكتمل أو ملغي", "danger");
      return;
    }

    setAssigningId(id);
    joinOrderRoom(id);

    socket.emit("center:assign-technician", {
      orderId: id,
      technicianId: technicianId.trim(),
      centerId: CENTER_ID,
    });

    addLog(`جاري تعيين الفني ${technicianId} للطلب ${shortId(id)}`);
  }

  function sendOrderOnTheWay(order) {
    const id = orderId(order);
    if (!id) return;

    socket.emit("order:on_the_way", {
      orderId: id,
      technicianId: technicianIdRef.current.trim() || "tech1",
    });

    setOrders((prev) =>
      prev.map((o) => (orderId(o) === id ? { ...o, status: "on_the_way" } : o))
    );

    joinOrderRoom(id);
    addLog(`تم تحويل الطلب إلى في الطريق: ${shortId(id)}`);
  }

  function sendTestTechnicianLocation(order, showUi = true) {
    if (!order) return;

    const id = orderId(order);
    const customer = getCustomerLocation(order);
    const last = technicianLocationsRef.current[id];

    const baseLat = last?.lat ?? customer.lat + 0.012;
    const baseLng = last?.lng ?? customer.lng + 0.012;

    const nextLat =
      baseLat + (customer.lat - baseLat) * 0.18 + (Math.random() - 0.5) * 0.0008;

    const nextLng =
      baseLng + (customer.lng - baseLng) * 0.18 + (Math.random() - 0.5) * 0.0008;

    const payload = {
      orderId: id,
      technicianId: technicianIdRef.current.trim() || "tech1",
      lat: nextLat,
      lng: nextLng,
      latitude: nextLat,
      longitude: nextLng,
      bearing: 90,
      heading: 90,
      speed: 8,
      location: {
        lat: nextLat,
        lng: nextLng,
        latitude: nextLat,
        longitude: nextLng,
        bearing: 90,
        heading: 90,
        speed: 8,
      },
      at: Date.now(),
    };

    joinOrderRoom(id);

    socket.emit("order:technician:location", payload);
    socket.emit("technician:location:update", payload);
    socket.emit("technicianLocationUpdate", payload);
    socket.emit("technician:location:updated", payload);
    socket.emit("technician_location", payload);
    socket.emit("technicianLocation", payload);

    setTechnicianLocations((prev) => ({
      ...prev,
      [id]: {
        lat: nextLat,
        lng: nextLng,
        bearing: 90,
        speed: 8,
        at: Date.now(),
      },
    }));

    if (showUi) {
      showToast("تم إرسال موقع فني تجربة", "success");
      addLog(`تم إرسال موقع فني تجربة للطلب ${shortId(id)}`);
    }
  }

  function testTechnicianMove() {
    if (!selectedOrder) {
      showToast("اختار طلب الأول", "danger");
      return;
    }

    sendTestTechnicianLocation(selectedOrder, true);
  }

  const mapsReady = Boolean(googleMapsApiKey) && isLoaded && !loadError;

  if (trackingFullScreen && selectedOrder) {
    return (
      <FullTracking
        toast={toast}
        connected={connected}
        selectedOrder={selectedOrder}
        technicianId={technicianId}
        setTechnicianId={setTechnicianId}
        setTrackingFullScreen={setTrackingFullScreen}
        assignTechnician={assignTechnician}
        sendOrderOnTheWay={sendOrderOnTheWay}
        testTechnicianMove={testTechnicianMove}
        autoMove={autoMove}
        setAutoMove={setAutoMove}
        isLoaded={mapsReady}
        mapCenter={mapCenter}
        customerLocation={customerLocation}
        technicianLocation={technicianLocation}
        currentDistanceKm={currentDistanceKm}
        currentEta={currentEta}
        mapRef={mapRef}
        fullMapRef={fullMapRef}
      />
    );
  }

  return (
    <div className="premium-dashboard" dir="rtl">
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <main className="content">
        <Header
          technicianId={technicianId}
          setTechnicianId={setTechnicianId}
          testTechnicianMove={testTechnicianMove}
          autoMove={autoMove}
          setAutoMove={setAutoMove}
          createFakeOrder={createFakeOrder}
        />

        <StatsCards stats={stats} />

        <section className="layout">
          <OrdersPanel
            filteredOrders={filteredOrders}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
            assigningId={assigningId}
            assignTechnician={assignTechnician}
            sendOrderOnTheWay={sendOrderOnTheWay}
            focusTracking={focusTracking}
          />

          <div className="panel map-panel">
            <div className="panel-head">
              <div>
                <h2>Live Tracking</h2>
                <p>
                  {selectedOrder
                    ? `الطلب #${shortId(orderId(selectedOrder))}`
                    : "اختر طلب لعرض الخريطة"}
                </p>
              </div>
            </div>

            <div className="map-wrap">
              {!googleMapsApiKey ? (
                <div className="empty-box">
                  ضيف VITE_GOOGLE_MAPS_API_KEY في ملف .env
                </div>
              ) : loadError ? (
                <div className="empty-box">في مشكلة في تحميل Google Maps</div>
              ) : (
                <TrackingMap
                  isLoaded={mapsReady}
                  selectedOrder={selectedOrder}
                  mapCenter={mapCenter}
                  customerLocation={customerLocation}
                  technicianLocation={technicianLocation}
                  mapRef={mapRef}
                  fullMapRef={fullMapRef}
                />
              )}
            </div>

            <TrackingInfo
              selectedOrder={selectedOrder}
              technicianLocation={technicianLocation}
              currentDistanceKm={currentDistanceKm}
              currentEta={currentEta}
            />
          </div>

          <LogsPanel logs={logs} />
        </section>
      </main>

      <Sidebar
        connected={connected}
        selectedOrder={selectedOrder}
        setTrackingFullScreen={setTrackingFullScreen}
        showToast={showToast}
      />
    </div>
  );
  }
  