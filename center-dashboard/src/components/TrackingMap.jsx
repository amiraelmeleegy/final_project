import { useEffect, useMemo, useState } from "react";
import {
  DirectionsRenderer,
  GoogleMap,
  Marker,
  OverlayView,
} from "@react-google-maps/api";
import { Clock3, MapPinned, Navigation, Route, UserRound } from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "24px",
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b1220" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#020617" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2563eb" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function MarkerBubble({ position, type, title, subtitle }) {
  return (
    <OverlayView position={position} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
      <div className={`map-marker-bubble ${type}`}>
        <div className="map-marker-icon">
          {type === "customer" ? <UserRound size={18} /> : <Navigation size={18} />}
        </div>

        <div className="map-marker-text">
          <b>{title}</b>
          <span>{subtitle}</span>
        </div>
      </div>
    </OverlayView>
  );
}

export default function TrackingMap({
  big = false,
  isLoaded,
  selectedOrder,
  mapCenter,
  customerLocation,
  technicianLocation,
  mapRef,
  fullMapRef,
}) {
  const [directions, setDirections] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeStatus, setRouteStatus] = useState("");

  const routeKey = useMemo(() => {
    if (!customerLocation || !technicianLocation) return "";
    return `${customerLocation.lat},${customerLocation.lng}-${technicianLocation.lat},${technicianLocation.lng}`;
  }, [customerLocation, technicianLocation]);

  useEffect(() => {
    if (!isLoaded || !window.google || !customerLocation || !technicianLocation) {
      setDirections(null);
      setRouteInfo(null);
      return;
    }

    const service = new window.google.maps.DirectionsService();

    service.route(
      {
        origin: technicianLocation,
        destination: customerLocation,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        console.log("DIRECTIONS STATUS:", status);

        if (status === "OK" && result) {
          const leg = result.routes?.[0]?.legs?.[0];

          setDirections(result);
          setRouteStatus("OK");
          setRouteInfo({
            distance: leg?.distance?.text || "",
            duration: leg?.duration?.text || "",
          });
        } else {
          setDirections(null);
          setRouteInfo(null);
          setRouteStatus(status || "ERROR");
        }
      }
    );
  }, [isLoaded, routeKey]);

  if (!selectedOrder) {
    return (
      <div className="empty-box premium-map-empty">
        <MapPinned size={36} />
        <h3>اختر طلب</h3>
        <p>اختار طلب من القائمة عشان يظهر التتبع المباشر.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="empty-box premium-map-empty">
        <Route size={36} />
        <h3>جاري تحميل الخريطة</h3>
        <p>بنجهز Google Maps والتتبع اللحظي.</p>
      </div>
    );
  }

  return (
    <div className="uber-map-shell">
      <GoogleMap
        mapContainerStyle={big ? { width: "100%", height: "100%" } : mapContainerStyle}
        center={mapCenter}
        zoom={14}
        onLoad={(map) => {
          if (big) fullMapRef.current = map;
          else mapRef.current = map;
        }}
        options={{
          styles: darkMapStyle,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          zoomControlOptions: {
            position: window.google?.maps?.ControlPosition?.LEFT_BOTTOM,
          },
        }}
      >
        <Marker position={customerLocation} opacity={0} />

        <MarkerBubble
          position={customerLocation}
          type="customer"
          title="العميل"
          subtitle="موقع الطلب"
        />

        {technicianLocation && (
          <>
            <Marker position={technicianLocation} opacity={0} />

            <MarkerBubble
              position={technicianLocation}
              type="technician"
              title="الفني"
              subtitle="يتحرك الآن"
            />

            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  preserveViewport: false,
                  polylineOptions: {
                    strokeColor: "#22d3ee",
                    strokeWeight: big ? 7 : 6,
                    strokeOpacity: 0.95,
                  },
                }}
              />
            )}
          </>
        )}
      </GoogleMap>

      <div className="map-floating-card">
        <div className="map-floating-icon">
          <Navigation size={20} />
        </div>

        <div>
          <b>Live Route</b>
          <span>
            {routeInfo
              ? `${routeInfo.distance} • ${routeInfo.duration}`
              : technicianLocation
              ? routeStatus && routeStatus !== "OK"
                ? `Route error: ${routeStatus}`
                : "جاري حساب الطريق..."
              : "بانتظار موقع الفني"}
          </span>
        </div>
      </div>

      {routeInfo && (
        <div className="map-route-pill">
          <Clock3 size={16} />
          <span>{routeInfo.duration}</span>
        </div>
      )}
    </div>
  );
}