import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

export default function UserActivity() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const [users, engagementStats] = await Promise.all([
          apiService.getUsers(1, 20, {}, true),
          apiService.getEngagementStats(id)
        ]);
        const foundUser = users.items?.find((u: any) => u.id === id);
        setUser(foundUser);
        setStats(engagementStats);
      } catch (e) {
        console.error('Failed to load user activity:', e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  if (loading) {
    return <div className="p-6">Loading user activity...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">User Activity</h1>
        </div>
      </div>

      {/* User Info */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">User Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Email:</span>
            <p className="font-medium">{user?.email || '—'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Full Name:</span>
            <p className="font-medium">{user?.full_name || '—'}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Status:</span>
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
              user?.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {user?.status || 'unknown'}
            </span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Role:</span>
            <p className="font-medium">{user?.role || '—'}</p>
          </div>
        </div>
      </div>

      {/* Engagement Stats */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Engagement Statistics</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Chats</p>
            <p className="text-2xl font-bold text-blue-600">{stats?.total_chats || 0}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Total Messages</p>
            <p className="text-2xl font-bold text-green-600">{stats?.total_messages || 0}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">Images Generated</p>
            <p className="text-2xl font-bold text-purple-600">{stats?.images_generated || 0}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600">Characters Created</p>
            <p className="text-2xl font-bold text-orange-600">{stats?.characters_created || 0}</p>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="text-gray-500 text-center py-8">
          Activity timeline visualization coming soon
        </div>
      </div>
    </div>
  );
}
