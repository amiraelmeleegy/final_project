export const statusLabels = {
  pending: "بانتظار فني",
  searching: "جاري البحث",
  contacting: "تواصل",
  timeout: "انتهى الوقت",
  assigned: "تم التعيين",
  accepted: "مقبول",
  on_the_way: "في الطريق",
  arrived: "وصل",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  canceled: "ملغي",
  cancelled: "ملغي",
};

export const waitingStatuses = ["pending", "searching", "contacting", "timeout"];

export const locationListenEvents = [
  "order:location:update",
  "order:technician:location",
  "technicianLocationUpdate",
  "technician:location:update",
  "technician:location:updated",
  "technician_location",
  "technicianLocation",
];

export function orderId(order) {
  return String(order?._id || order?.id || order?.orderId || "");
}

export function orderStatus(order) {
  return String(order?.status || "pending");
}

export function serviceName(order) {
  return (
    order?.serviceType ||
    order?.serviceName ||
    order?.service?.name ||
    order?.selectedServices?.[0] ||
    "خدمة طريق"
  );
}

export function customerName(order) {
  return order?.userName || order?.user?.name || order?.customerName || "عميل";
}

export function assignedTech(order) {
  const tech = order?.technician;

  if (typeof tech === "string") return tech;

  return (
    tech?.techId ||
    tech?.id ||
    tech?._id ||
    tech?.techName ||
    order?.technicianId ||
    ""
  );
}

export function shortId(id) {
  const value = String(id || "");
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-5)}`;
}

export function canAssign(order) {
  return !["completed", "canceled", "cancelled"].includes(orderStatus(order));
}

export function upsertOrder(prev, incoming) {
  const id = orderId(incoming);
  if (!id) return prev;

  const exists = prev.some((o) => orderId(o) === id);
  if (!exists) return [incoming, ...prev];

  return prev.map((o) => (orderId(o) === id ? { ...o, ...incoming } : o));
}