import {
  Activity,
  Bell,
  Car,
  ChevronLeft,
  Gauge,
  Headset,
  MapPinned,
  RadioTower,
  Settings,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";

export default function Sidebar({
  connected,
  selectedOrder,
  setTrackingFullScreen,
  showToast,
}) {
  const navItems = [
    {
      label: "لوحة التحكم",
      icon: Gauge,
      active: true,
      onClick: null,
    },
    {
      label: "الطلبات",
      icon: Headset,
      active: false,
      onClick: null,
    },
    {
      label: "الفنيين",
      icon: Users,
      active: false,
      onClick: null,
    },
    {
      label: "التتبع المباشر",
      icon: MapPinned,
      active: false,
      onClick: () => {
        if (selectedOrder) setTrackingFullScreen(true);
        else showToast("اختار طلب الأول", "danger");
      },
    },
    {
      label: "الإشعارات",
      icon: Bell,
      active: false,
      onClick: null,
    },
    {
      label: "الإعدادات",
      icon: Settings,
      active: false,
      onClick: null,
    },
  ];

  return (
    <aside className="side">
      <div className="brand">
        <div className="logo">
          <Car size={28} strokeWidth={2.7} />
        </div>

        <div>
          <h2>Doctor Car</h2>
          <p>Operations Center</p>
        </div>
      </div>

      <div className={connected ? "side-status status-online" : "side-status status-offline"}>
        <div className="status-icon">
          {connected ? <Wifi size={22} /> : <WifiOff size={22} />}
        </div>

        <div>
          <b>{connected ? "Online" : "Offline"}</b>
          <p>{connected ? "Socket connected" : "Trying to reconnect"}</p>
        </div>
      </div>

      <div className="side-mini-card">
        <div className="mini-icon">
          <RadioTower size={22} />
        </div>

        <div>
          <b>Live Dispatch</b>
          <p>مراقبة الطلبات والتتبع</p>
        </div>
      </div>

      <nav className="side-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className={item.active ? "nav-active" : ""}
              onClick={item.onClick || undefined}
              type="button"
            >
              <span className="nav-icon">
                <Icon size={21} strokeWidth={2.5} />
              </span>

              <span className="nav-label">{item.label}</span>

              <ChevronLeft className="nav-arrow" size={18} strokeWidth={2.5} />
            </button>
          );
        })}
      </nav>

      <div className="side-footer">
        <div className="side-footer-icon">
          <ShieldCheck size={22} />
        </div>

        <div>
          <b>Secure Center</b>
          <p>Admin dashboard</p>
        </div>
      </div>

      <div className="side-tools">
        <div>
          <Activity size={18} />
          <span>Live</span>
        </div>

        <div>
          <Wrench size={18} />
          <span>Roadside</span>
        </div>
      </div>
    </aside>
  );
}