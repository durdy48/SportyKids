interface AdminMetricCardProps {
  title: string;
  value: string | number;
  trend?: { value: number; label: string };
  icon?: React.ReactNode;
  severity?: 'normal' | 'warning' | 'error';
}

export function AdminMetricCard({ title, value, trend, icon, severity = 'normal' }: AdminMetricCardProps) {
  const borderColor =
    severity === 'error'
      ? 'border-red-800'
      : severity === 'warning'
        ? 'border-yellow-800'
        : 'border-slate-800';

  const trendColor = trend && trend.value >= 0 ? 'text-green-400' : 'text-red-400';
  const trendArrow = trend && trend.value >= 0 ? '↑' : '↓';

  return (
    <div className={`bg-slate-900 border ${borderColor} rounded-xl p-4`}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-400 font-medium">{title}</p>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
      {trend && (
        <p className={`text-xs mt-1 ${trendColor}`}>
          {trendArrow} {Math.abs(trend.value)}% {trend.label}
        </p>
      )}
    </div>
  );
}
