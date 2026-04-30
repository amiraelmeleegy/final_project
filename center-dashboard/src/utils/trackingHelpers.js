import { socket } from "../socket";

export function getCustomerLocation(order) {
  return {
    lat: Number(
      order?.customerLocation?.lat ||
        order?.location?.lat ||
        order?.pickupLocation?.lat ||
        30.0444
    ),
    lng: Number(
      order?.customerLocation?.lng ||
        order?.location?.lng ||
        order?.pickupLocation?.lng ||
        31.2357
    ),
  };
}

export function getLocationFromPayload(data) {
  const id = String(
    data?.orderId || data?.order_id || data?.requestId || data?.bookingId || ""
  );

  const lat = Number(data?.location?.lat ?? data?.lat ?? data?.latitude);
  const lng = Number(data?.location?.lng ?? data?.lng ?? data?.longitude);
  const bearing = Number(data?.location?.bearing ?? data?.bearing ?? data?.heading ?? 0);
  const speed = Number(data?.location?.speed ?? data?.speed ?? 0);

  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    id,
    lat,
    lng,
    bearing: Number.isFinite(bearing) ? bearing : 0,
    speed: Number.isFinite(speed) ? speed : 0,
  };
}

export function joinOrderRoom(id) {
  const cleanId = String(id || "").trim();
  if (!cleanId) return;

  socket.emit("order:join", { orderId: cleanId });
  socket.emit("joinOrderRoom", { orderId: cleanId });
  socket.emit("join_order", { orderId: cleanId });
}

export function distanceMeters(a, b) {
  if (!a || !b) return 0;

  const r = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function etaMinutes(customer, tech) {
  const d = distanceMeters(customer, tech);
  const speed = 8.5;
  return Math.max(1, Math.ceil(d / speed / 60));
}