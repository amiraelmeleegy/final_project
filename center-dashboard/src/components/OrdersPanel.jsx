import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Compass,
  Eye,
  Filter,
  MapPin,
  Navigation,
  PhoneCall,
  Search,
  Timer,
  User,
  UserCheck,
  Wrench,
  XCircle,
} from "lucide-react";

import {
  assignedTech,
  canAssign,
  customerName,
  orderId,
  orderStatus,
  serviceName,
  shortId,
  statusLabels,
} from "../utils/orderHelpers";

import { getCustomerLocation, joinOrderRoom } from "../utils/trackingHelpers";

function statusIcon(status) {
  if (["completed"].includes(status)) return CheckCircle2;
  if (["canceled", "cancelled"].includes(status)) return XCircle;
  if (["assigned", "accepted", "on_the_way", "arrived", "in_progress"].includes(status)) {
    return Navigation;
  }
  if (["timeout"].includes(status)) return AlertCircle;
  return Clock3;
}

function formatTime(value) {
  return new Date(value || Date.now()).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPanel({
  filteredOrders,
  selectedOrderId,
  setSelectedOrderId,
  filter,
  setFilter,
  query,
  setQuery,
  assigningId,
  assignTechnician,
  sendOrderOnTheWay,
  focusTracking,
}) {
  const filters = [
    ["all", "الكل"],
    ["waiting", "بانتظار"],
    ["assigned", "تم التعيين"],
    ["on_the_way", "في الطريق"],
    ["arrived", "وصل"],
    ["completed", "مكتمل"],
    ["canceled", "ملغي"],
  ];

  return (
    <div className="panel orders-panel premium-orders">
      <div className="panel-head orders-head">
        <div>
          <div className="section-kicker">
            <Filter size={16} />
            <span>Orders Queue</span>
          </div>

          <h2>الطلبات</h2>
          <p>{filteredOrders.length} طلب ظاهر في قائمة التشغيل</p>
        </div>

        <div className="orders-count-pill">
          <Timer size={17} />
          <span>{filteredOrders.length}</span>
        </div>
      </div>

      <div className="filters premium-filters">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="premium-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالطلب، العميل، الفني، أو الخدمة..."
        />
      </label>

      <div className="orders-list premium-orders-list">
        {filteredOrders.length === 0 ? (
          <div className="empty-box premium-empty">
            <div className="empty-icon">
              <Wrench size={34} />
            </div>
            <h3>لا توجد طلبات</h3>
            <p>أي طلب جديد هيوصل هيظهر هنا لحظيًا.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const id = orderId(order);
            const st = orderStatus(order);
            const active = selectedOrderId === id;
            const tech = assignedTech(order);
            const loc = getCustomerLocation(order);
            const StatusIcon = statusIcon(st);

            return (
              <article
                key={id}
                className={active ? "order-card premium-order-card selected" : "order-card premium-order-card"}
                onClick={() => {
                  setSelectedOrderId(id);
                  joinOrderRoom(id);
                }}
              >
                <div className="order-card-glow" />

                <div className="premium-order-top">
                  <div className="order-service-icon">
                    <Wrench size={21} />
                  </div>

                  <div className="order-title-area">
                    <h3>{serviceName(order)}</h3>

                    <div className="order-customer">
                      <User size={15} />
                      <span>{customerName(order)}</span>
                    </div>
                  </div>

                  <span className={`badge premium-badge ${st}`}>
                    <StatusIcon size={14} />
                    {statusLabels[st] || st}
                  </span>
                </div>

                <div className="order-meta-grid">
                  <div>
                    <Compass size={15} />
                    <span>#{shortId(id)}</span>
                  </div>

                  <div>
                    <Clock3 size={15} />
                    <span>{formatTime(order.createdAt)}</span>
                  </div>
                </div>

                <div className="order-info-lines">
                  <div>
                    <MapPin size={16} />
                    <span>
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                    </span>
                  </div>

                  <div>
                    <UserCheck size={16} />
                    <span>{tech ? shortId(tech) : "لم يتم تعيين فني"}</span>
                  </div>
                </div>

                <div className="premium-actions-row">
                  <button
                    className="assign-btn"
                    disabled={assigningId === id || !canAssign(order)}
                    onClick={(e) => {
                      e.stopPropagation();
                      assignTechnician(order);
                    }}
                  >
                    <UserCheck size={17} />
                    <span>
                      {assigningId === id
                        ? "جاري التعيين..."
                        : st === "assigned"
                        ? "تغيير الفني"
                        : "تعيين فني"}
                    </span>
                  </button>

                  <button
                    className="secondary action-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      sendOrderOnTheWay(order);
                    }}
                  >
                    <Navigation size={17} />
                    <span>بدء الطريق</span>
                  </button>

                  <button
                    className="secondary action-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      focusTracking(order);
                    }}
                  >
                    <Eye size={17} />
                    <span>متابعة</span>
                  </button>
                </div>

                <div className="order-quick-actions">
                  <span>
                    <PhoneCall size={14} />
                    اتصال
                  </span>

                  <span>
                    <MapPin size={14} />
                    فتح الموقع
                  </span>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}