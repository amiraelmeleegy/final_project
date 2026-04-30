import {
  Activity,
  Clock,
  Radar,
  Truck,
} from "lucide-react";

export default function StatsCards({ stats }) {
  const cards = [
    {
      label: "إجمالي الطلبات",
      value: stats.total,
      icon: Activity,
      className: "stat-blue",
    },
    {
      label: "بانتظار فني",
      value: stats.waiting,
      icon: Clock,
      className: "stat-yellow",
    },
    {
      label: "طلبات نشطة",
      value: stats.assigned,
      icon: Truck,
      className: "stat-green",
    },
    {
      label: "تتبع مباشر",
      value: stats.live,
      icon: Radar,
      className: "stat-cyan",
    },
  ];

  return (
    <section className="stats premium-stats">
      {cards.map((card, index) => {
        const Icon = card.icon;

        return (
          <div key={index} className={`stat-card ${card.className}`}>
            <div className="stat-top">
              <div className="stat-icon">
                <Icon size={22} strokeWidth={2.5} />
              </div>

              <span className="stat-label">{card.label}</span>
            </div>

            <div className="stat-value">{card.value}</div>

            <div className="stat-glow" />
          </div>
        );
      })}
    </section>
  );
}