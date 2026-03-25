import { useEffect, useState } from 'react';
import { Modal, Notification } from '../components/Modal';
import { apiService } from '../services/api';
import Pagination from '../components/Pagination';

export default function PushNotification() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [showSendModal, setShowSendModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState({ title: '', body: '', target: 'all', user_ids: '' });

  const fetchNotifications = async (p = page, pp = perPage, force = false) => {
    try {
      setLoading(true);
      const data = await apiService.getPushNotifications(p, pp, { search: undefined }, force);
      const items = data.items || [];
      setNotifications(items);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
      // If backend route doesn't exist, surface a user-friendly notification
      // Axios errors expose `response.status`.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const status = e?.response?.status;
      if (status === 404) {
        setNotification({ show: true, message: 'Push notifications backend not available (404)', type: 'error' });
        setNotifications([]);
        setTotal(0);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  useEffect(() => { setPage(1); fetchNotifications(1, perPage, true); }, [perPage]);

  const handleSend = async () => {
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('admin_token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/push-notifications/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      setNotification({ show: true, message: 'Notification sent successfully', type: 'success' });
      setShowSendModal(false);
      fetchNotifications();
    } catch (e) {
      setNotification({ show: true, message: 'Failed to send notification', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Push Notifications</h1>
        <button
          onClick={() => setShowSendModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Send Notification
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Body</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Sent At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-600">Loading...</td></tr>
            ) : notifications.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-600">No notifications sent yet</td></tr>
            ) : (
              notifications.map(notif => (
                <tr key={notif.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{notif.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{notif.body}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{notif.target}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{new Date(notif.sent_at).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      {notif.status || 'sent'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => { setPage(p); fetchNotifications(p, perPage); }} onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchNotifications(1, pp); }} />

      {showSendModal && (
        <Modal isOpen={showSendModal} onClose={() => setShowSendModal(false)} title="Send Push Notification">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Notification title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={formData.body}
                onChange={(e) => setFormData({...formData, body: e.target.value})}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Notification message"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
              <select
                value={formData.target}
                onChange={(e) => setFormData({...formData, target: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Users</option>
                <option value="premium">Premium Users</option>
                <option value="free">Free Users</option>
                <option value="specific">Specific Users</option>
              </select>
            </div>
            {formData.target === 'specific' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User IDs (comma separated)</label>
                <input
                  type="text"
                  value={formData.user_ids}
                  onChange={(e) => setFormData({...formData, user_ids: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="user1,user2,user3"
                />
              </div>
            )}
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setShowSendModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSend} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Send</button>
            </div>
          </div>
        </Modal>
      )}

      {notification.show && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification({...notification, show: false})} />
      )}
    </div>
  );
}
