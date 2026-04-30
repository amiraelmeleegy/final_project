import {
  Car,
  Clock3,
  Compass,
  MapPin,
  Route,
  ShieldCheck,
  User,
  UserCheck,
  Wrench,
} from "lucide-react";

import {
  assignedTech,
  customerName,
  orderStatus,
  serviceName,
  shortId,
  statusLabels,
} from "../utils/orderHelpers";

function InfoCard({ icon: Icon, label, value, className = "" }) {
  return (
    <div className={`tracking-info-card ${className}`}>
      <div className="tracking-info-icon">
        <Icon size={19} strokeWidth={2.5} />
      </div>

      <div>
        <p>{label}</p>
        <b>{value}</b>
      </div>
    </div>
  );
}

export default function TrackingInfo({
  selectedOrder,
  technicianLocation,
  currentDistanceKm,
  currentEta,
}) {
  const status = selectedOrder ? orderStatus(selectedOrder) : "-";
  const tech = selectedOrder && assignedTech(selectedOrder);

  return (
    <div className="tracking-info premium-tracking-info">
      <InfoCard
        icon={User}
        label="العميل"
        value={selectedOrder ? customerName(selectedOrder) : "-"}
        className="info-blue"
      />

      <InfoCard
        icon={Wrench}
        label="الخدمة"
        value={selectedOrder ? serviceName(selectedOrder) : "-"}
        className="info-cyan"
      />

      <InfoCard
        icon={ShieldCheck}
        label="الحالة"
        value={selectedOrder ? statusLabels[status] || status : "-"}
        className="info-green"
      />

      <InfoCard
        icon={UserCheck}
        label="الفني المعين"
        value={tech ? shortId(tech) : "لم يتم"}
        className="info-purple"
      />

      <InfoCard
        icon={Route}
        label="المسافة"
        value={technicianLocation ? `${currentDistanceKm} كم` : "-"}
        className="info-orange"
      />

      <InfoCard
        icon={Clock3}
        label="ETA"
        value={technicianLocation ? `${currentEta} دقيقة` : "-"}
        className="info-yellow"
      />

      <InfoCard
        icon={MapPin}
        label="موقع الفني"
        value={
          technicianLocation
            ? `${technicianLocation.lat.toFixed(4)}, ${technicianLocation.lng.toFixed(4)}`
            : "لم يصل بعد"
        }
        className="info-red wide-info-card"
      />

      <InfoCard
        icon={Car}
        label="Live Tracking"
        value={technicianLocation ? "متصل الآن" : "بانتظار الإشارة"}
        className="info-cyan"
      />
    </div>
  );
}