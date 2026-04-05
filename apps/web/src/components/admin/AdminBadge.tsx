type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple';

interface AdminBadgeProps {
  label: string;
  variant: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  green: 'bg-green-900 text-green-300',
  yellow: 'bg-yellow-900 text-yellow-300',
  red: 'bg-red-900 text-red-300',
  gray: 'bg-slate-700 text-slate-300',
  blue: 'bg-blue-900 text-blue-300',
  purple: 'bg-purple-900 text-purple-300',
};

export function AdminBadge({ label, variant }: AdminBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}>
      {label}
    </span>
  );
}
