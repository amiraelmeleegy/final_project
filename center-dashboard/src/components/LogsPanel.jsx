import { Activity, Clock3, BellRing } from "lucide-react";

export default function LogsPanel({ logs }) {
  return (
    <div className="panel logs-panel premium-logs">
      <div className="panel-head">
        <div>
          <h2 className="logs-title">
            <Activity size={20} /> سجل الأحداث
          </h2>
          <p>آخر تحديثات النظام لحظيًا</p>
        </div>

        <div className="logs-badge">
          <BellRing size={16} />
          <span>{logs.length}</span>
        </div>
      </div>

      <div className="logs">
        {logs.length === 0 ? (
          <div className="empty-box premium-empty">
            <Activity size={32} />
            <h3>لا توجد أحداث</h3>
            <p>أي نشاط جديد هيظهر هنا مباشرة.</p>
          </div>
        ) : (
          logs.slice(0, 20).map((log, i) => (
            <div className="log premium-log" key={log.id}>
              <div className="log-line" />

              <div className="log-content">
                <div className="log-time">
                  <Clock3 size={14} />
                  <span>{log.time}</span>
                </div>

                <p>{log.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}