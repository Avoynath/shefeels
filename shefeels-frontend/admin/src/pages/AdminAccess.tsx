import { useEffect, useState } from 'react';
import { Modal, Notification } from '../components/Modal';

export default function AdminAccess() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState({ email: '', role: 'admin', permissions: [] as string[] });

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('hl_token') || localStorage.getItem('admin_token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/admin-users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAdmins(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch admins:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleInvite = async () => {
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('admin_token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/admin-users/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      setNotification({ show: true, message: 'Invitation sent successfully', type: 'success' });
      setShowModal(false);
      fetchAdmins();
    } catch (e) {
      setNotification({ show: true, message: 'Failed to send invitation', type: 'error' });
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('admin_token');
      await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/admin-users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotification({ show: true, message: 'Access revoked successfully', type: 'success' });
      fetchAdmins();
    } catch (e) {
      setNotification({ show: true, message: 'Failed to revoke access', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Access Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Invite Admin
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-600">Loading...</td></tr>
            ) : admins.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-600">No admin users found</td></tr>
            ) : (
              admins.map(admin => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{admin.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                      {admin.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      admin.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {admin.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{admin.last_login ? new Date(admin.last_login).toLocaleDateString() : 'Never'}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleRevoke(admin.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Invite Admin User">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
                <option value="moderator">Moderator</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleInvite} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Send Invitation</button>
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
