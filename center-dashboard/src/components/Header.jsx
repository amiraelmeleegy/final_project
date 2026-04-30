import {
  Activity,
  BellRing,
  CarFront,
  MapPinned,
  Play,
  Plus,
  Radio,
  Route,
  Search,
  Sparkles,
  UserRoundCog,
  Zap,
} from "lucide-react";

export default function Header({
  technicianId,
  setTechnicianId,
  testTechnicianMove,
  autoMove,
  setAutoMove,
  createFakeOrder,
}) {
  return (
    <header className="hero">
      <div className="hero-main">
        <div className="hero-kicker">
          <span className="hero-kicker-icon">
            <Sparkles size={18} strokeWidth={2.8} />
          </span>
          <span>لوحة تحكم المركز</span>
        </div>

        <h1>غرفة عمليات Doctor Car</h1>

        <p>
          إدارة الطلبات، تعيين الفنيين، ومتابعة الحركة اللحظية على الخريطة من
          مكان واحد.
        </p>

        <div className="hero-badges">
          <div>
            <Activity size={17} />
            <span>Live Orders</span>
          </div>

          <div>
            <MapPinned size={17} />
            <span>GPS Tracking</span>
          </div>

          <div>
            <BellRing size={17} />
            <span>Instant Alerts</span>
          </div>
        </div>
      </div>

      <div className="hero-control-card">
        <div className="hero-control-head">
          <div className="hero-control-icon">
            <UserRoundCog size={24} />
          </div>

          <div>
            <b>Dispatch Control</b>
            <p>اختبار التعيين والتتبع</p>
          </div>
        </div>

        <label className="hero-input-label">
          <span>
            <Search size={16} />
            ID الفني
          </span>

          <input
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            placeholder="مثال: tech1"
          />
        </label>

        <div className="hero-actions premium-actions">
          <button className="btn soft icon-btn" onClick={testTechnicianMove}>
            <Route size={18} />
            <span>تحريك الفني</span>
          </button>

          <button
            className={autoMove ? "btn warning icon-btn" : "btn soft icon-btn"}
            onClick={() => setAutoMove((v) => !v)}
          >
            {autoMove ? <Radio size={18} /> : <Play size={18} />}
            <span>{autoMove ? "إيقاف اللايف" : "تشغيل لايف"}</span>
          </button>

          <button className="btn primary icon-btn" onClick={createFakeOrder}>
            <Plus size={18} />
            <span>طلب تجربة</span>
          </button>
        </div>

        <div className="hero-mini-stats">
          <div>
            <CarFront size={18} />
            <span>Roadside</span>
          </div>

          <div>
            <Zap size={18} />
            <span>Fast Dispatch</span>
          </div>
        </div>
      </div>
    </header>
  );
}