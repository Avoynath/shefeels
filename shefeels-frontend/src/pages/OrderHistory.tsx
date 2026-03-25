import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import fetchWithAuth from '../utils/fetchWithAuth';
import { buildApiUrl } from '../utils/apiBase';
import Button from '../components/Button';
import tokenIcon from '../assets/token.svg';

interface Order {
  id: string;
  created_at: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  type: string;
  provider?: string;
  coins_received?: number;
}

interface OrderHistoryResponse {
  orders: Order[];
  total: number;
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyles = () => {
    switch (status.toLowerCase()) {
      case 'success':
      case 'completed':
        return {
          bg: 'rgba(34, 197, 94, 0.15)',
          text: '#22c55e',
          border: 'rgba(34, 197, 94, 0.3)',
        };
      case 'pending':
        return {
          bg: 'rgba(255, 197, 77, 0.15)',
          text: '#FFC54D',
          border: 'rgba(255, 197, 77, 0.3)',
        };
      case 'failed':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          text: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)',
        };
      default:
        return {
          bg: 'rgba(156, 163, 175, 0.15)',
          text: '#9ca3af',
          border: 'rgba(156, 163, 175, 0.3)',
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <span
      className="px-3 py-1 rounded-full text-xs font-semibold"
      style={{
        background: styles.bg,
        color: styles.text,
        border: `1px solid ${styles.border}`,
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default function OrderHistory() {
  const { isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchWithAuth(buildApiUrl('/api/v1/user/orders'), {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch order history');
        }

        const data: OrderHistoryResponse = await response.json();
        // Ensure latest transactions appear first by default
        const fetched = data.orders || [];
        fetched.sort((a, b) => {
          const da = new Date(a.created_at).getTime();
          const db = new Date(b.created_at).getTime();
          return db - da;
        });
        setOrders(fetched);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Unable to load order history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, navigate]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    try {
      // If backend accidentally returns integer cents (e.g. 23999),
      // convert to dollars by dividing by 100. Use a heuristic threshold.
      const normalized = amount >= 1000 ? amount / 100 : amount;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(normalized);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen w-full flex items-center justify-center ${
        isDark ? 'bg-[#000000]' : 'bg-gray-50'
      }`}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4"
            style={{
              borderColor: 'rgba(255, 197, 77, 0.2)',
              borderTopColor: '#FFC54D',
            }}
          />
          <p className={isDark ? 'text-white/70' : 'text-gray-600'}>Loading order history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full ${isDark ? 'bg-[#000000]' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl sm:text-4xl font-bold mb-2 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Order History
          </h1>
          <p className={isDark ? 'text-white/60' : 'text-gray-600'}>
            View all your token purchases and transactions
          </p>
        </div>

        {error && (
          <div
            className="mb-6 p-4 rounded-xl"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <p style={{ color: '#ef4444' }}>{error}</p>
          </div>
        )}

        {orders.length === 0 && !error ? (
          <div
            className="rounded-2xl p-12 text-center"
            style={{
              background: isDark
                ? 'linear-gradient(124deg, #000000 37.56%, rgba(255, 183, 3, 0.08) 203.74%)'
                : 'rgba(255, 255, 255, 0.9)',
              border: `1px solid ${isDark ? 'rgba(192, 155, 98, 0.4)' : 'rgba(192, 155, 98, 0.2)'}`,
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <div
                className="p-4 rounded-full"
                style={{
                  background: 'rgba(255, 197, 77, 0.15)',
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFC54D"
                  strokeWidth="1.5"
                >
                  <path d="M9 11l3 3 8-8M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                No orders yet
              </h3>
              <p className={isDark ? 'text-white/60' : 'text-gray-600'}>
                Your token purchase history will appear here
              </p>
              <Button
                onClick={() => navigate('/buy-tokens')}
                className="mt-4"
                style={{
                  background: 'linear-gradient(90deg, #FFC54D 0%, #FFD700 100%)',
                  color: '#000',
                }}
              >
                Buy Tokens
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-2xl"
              style={{
                background: isDark
                  ? 'linear-gradient(124deg, #000000 37.56%, rgba(255, 183, 3, 0.08) 203.74%)'
                  : 'rgba(255, 255, 255, 0.9)',
                border: `1px solid ${isDark ? 'rgba(192, 155, 98, 0.4)' : 'rgba(192, 155, 98, 0.2)'}`,
              }}
            >
              <table className="w-full">
                <thead>
                  <tr
                    style={{
                      borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? 'text-white/80' : 'text-gray-700'
                    }`}>
                      Date
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? 'text-white/80' : 'text-gray-700'
                    }`}>
                      Description
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? 'text-white/80' : 'text-gray-700'
                    }`}>
                      Tokens
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? 'text-white/80' : 'text-gray-700'
                    }`}>
                      Amount
                    </th>
                    <th className={`px-6 py-4 text-left text-sm font-semibold ${
                      isDark ? 'text-white/80' : 'text-gray-700'
                    }`}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom: index !== orders.length - 1 
                          ? `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`
                          : 'none',
                      }}
                      className="transition-colors hover:bg-white/5"
                    >
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                        {formatDate(order.created_at)}
                      </td>
                      <td className={`px-6 py-4 text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {order.description}
                      </td>
                      <td className="px-6 py-4">
                        {order.coins_received ? (
                          <div className="flex items-center gap-2">
                            <img src={tokenIcon} alt="token" className="h-4 w-4" />
                            <span className={`text-sm font-semibold ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              {order.coins_received}
                            </span>
                          </div>
                        ) : (
                          <span className={isDark ? 'text-white/40' : 'text-gray-400'}>-</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-sm font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {formatCurrency(order.amount, order.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl p-4"
                  style={{
                    background: isDark
                      ? 'linear-gradient(124deg, #000000 37.56%, rgba(255, 183, 3, 0.08) 203.74%)'
                      : 'rgba(255, 255, 255, 0.9)',
                    border: `1px solid ${isDark ? 'rgba(192, 155, 98, 0.4)' : 'rgba(192, 155, 98, 0.2)'}`,
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className={`text-sm font-semibold mb-1 ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {order.description}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="flex justify-between items-center pt-3"
                    style={{
                      borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    }}
                  >
                    <div>
                      {order.coins_received ? (
                        <div className="flex items-center gap-2">
                          <img src={tokenIcon} alt="token" className="h-4 w-4" />
                          <span className={`text-sm font-semibold ${
                            isDark ? 'text-white' : 'text-gray-900'
                          }`}>
                            {order.coins_received} tokens
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatCurrency(order.amount, order.currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div
              className="rounded-xl p-6 mt-6"
              style={{
                background: isDark
                  ? 'linear-gradient(124deg, #000000 37.56%, rgba(255, 183, 3, 0.12) 203.74%)'
                  : 'rgba(255, 255, 255, 0.9)',
                border: `1px solid ${isDark ? 'rgba(192, 155, 98, 0.5)' : 'rgba(192, 155, 98, 0.3)'}`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                  Total Transactions
                </span>
                <span className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {orders.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <Button
            onClick={() => navigate('/profile')}
            className="px-6 py-3"
            style={{
              background: isDark 
                ? 'rgba(255, 255, 255, 0.05)' 
                : 'rgba(0, 0, 0, 0.05)',
              border: `1px solid ${isDark ? 'rgba(192, 155, 98, 0.3)' : 'rgba(192, 155, 98, 0.2)'}`,
              color: isDark ? '#FFC54D' : '#C09B62',
            }}
          >
            Back to Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
