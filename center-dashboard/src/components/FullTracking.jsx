import {
  ArrowRight,
  Car,
  MapPinned,
  Navigation,
  Play,
  Radio,
  Route,
  UserRoundCog,
} from "lucide-react";

import TrackingMap from "./TrackingMap";
import TrackingInfo from "./TrackingInfo";
import { orderId, shortId } from "../utils/orderHelpers";

export default function FullTracking({
  toast,
  connected,
  selectedOrder,
  technicianId,
  setTechnicianId,
  setTrackingFullScreen,
  assignTechnician,
  sendOrderOnTheWay,
  testTechnicianMove,
  autoMove,
  setAutoMove,
  isLoaded,
  mapCenter,
  customerLocation,
  technicianLocation,
  currentDistanceKm,
  currentEta,
  mapRef,
  fullMapRef,
}) {
  return (
    <div className="uber-tracking-page" dir="rtl">
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}

      <div className="uber-topbar">
        <button className="uber-back-btn" onClick={() => setTrackingFullScreen(false)}>
          <ArrowRight size={20} />
          <span>رجوع للطلبات</span>
        </button>

        <div className={connected ? "uber-live-pill on" : "uber-live-pill off"}>
          <span />
          {connected ? "Online" : "Offline"}
        </div>
      </div>

      <section className="uber-tracking-shell">
        <div className="uber-map-area">
          <TrackingMap
            big
            isLoaded={isLoaded}
            selectedOrder={selectedOrder}
            mapCenter={mapCenter}
            customerLocation={customerLocation}
            technicianLocation={technicianLocation}
            mapRef={mapRef}
            fullMapRef={fullMapRef}
          />
        </div>

        <aside className="uber-control-panel">
          <div className="uber-panel-head">
            <div className="uber-panel-icon">
              <Navigation size={26} />
            </div>

            <div>
              <h1>Live Tracking</h1>
              <p>الطلب #{shortId(orderId(selectedOrder))}</p>
            </div>
          </div>

          <div className="uber-route-summary">
            <div>
              <Route size={20} />
              <span>المسافة</span>
              <b>{technicianLocation ? `${currentDistanceKm} كم` : "-"}</b>
            </div>

            <div>
              <Car size={20} />
              <span>الوصول</span>
              <b>{technicianLocation ? `${currentEta} دقيقة` : "-"}</b>
            </div>
          </div>

          <label className="uber-tech-input">
            <span>
              <UserRoundCog size={16} />
              ID الفني
            </span>

            <input
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              placeholder="مثال: tech1"
            />
          </label>

          <div className="uber-actions">
            <button className="uber-primary" onClick={() => assignTechnician(selectedOrder)}>
              <UserRoundCog size={18} />
              تعيين / تغيير فني
            </button>

            <button onClick={() => sendOrderOnTheWay(selectedOrder)}>
              <Navigation size={18} />
              بدء الطريق
            </button>

            <button onClick={testTechnicianMove}>
              <MapPinned size={18} />
              تحريك الفني تجربة
            </button>

            <button
              className={autoMove ? "uber-warning" : ""}
              onClick={() => setAutoMove((v) => !v)}
            >
              {autoMove ? <Radio size={18} /> : <Play size={18} />}
              {autoMove ? "إيقاف الحركة" : "تشغيل حركة لايف"}
            </button>
          </div>

          <TrackingInfo
            selectedOrder={selectedOrder}
            technicianLocation={technicianLocation}
            currentDistanceKm={currentDistanceKm}
            currentEta={currentEta}
          />
        </aside>
      </section>
    </div>
  );
}