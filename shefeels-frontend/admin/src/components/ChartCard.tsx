import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChartCardProps {
  title: string;
  data?: any[];
  actions?: React.ReactNode;
}

export default function ChartCard({ title, data = [], actions }: ChartCardProps) {
  const [activeTab, setActiveTab] = useState('coinRevenue');
  
  // Use provided data only — do not fall back to synthetic sample data
  const chartData = Array.isArray(data) ? data : [];
  
  // Calculate totals
  const totalCoinRevenue = chartData.reduce((sum, item) => sum + (item.coinRevenue || 0), 0);
  const totalSubscriptionRevenue = chartData.reduce((sum, item) => sum + (item.subscriptionRevenue || 0), 0);
  const totalRevenue = totalCoinRevenue + totalSubscriptionRevenue;
  const avgMonthlyRevenue = chartData.length > 0 ? totalRevenue / chartData.length : 0;
  
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('coinRevenue')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'coinRevenue' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Coin Revenue
        </button>
        <button 
          onClick={() => setActiveTab('subscriptionRevenue')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'subscriptionRevenue' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Subscription Revenue
        </button>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="month" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={activeTab} 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Total Coin Revenue: <span className="font-semibold">${totalCoinRevenue.toFixed(2)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Total Subscription Revenue: <span className="font-semibold">${totalSubscriptionRevenue.toFixed(2)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span>Total Revenue: <span className="font-semibold">${totalRevenue.toFixed(2)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Avg Monthly Revenue: <span className="font-semibold">${avgMonthlyRevenue.toFixed(2)}</span></span>
        </div>
      </div>
    </div>
  );
}
