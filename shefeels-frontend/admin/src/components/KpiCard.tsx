interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  variant?: 'blue' | 'dark';
}

export default function KpiCard({ title, value, change, variant = 'dark' }: KpiCardProps) {
  const isPositive = change && parseFloat(change) >= 0;
  
  return (
    <div className={`rounded-xl p-6 ${
      variant === 'blue' 
        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' 
        : 'bg-gradient-to-br from-gray-800 to-gray-900 text-white'
    }`}>
      <div className="text-sm font-medium opacity-90 mb-2">{title}</div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold">{value}</div>
        {change && (
          <div className={`text-xs font-medium ${isPositive ? 'text-green-300' : 'text-red-300'}`}>
            {change}
          </div>
        )}
      </div>
    </div>
  );
}
