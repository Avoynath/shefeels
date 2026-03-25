import { useEffect, useState } from 'react';
import { Modal, Notification } from '../components/Modal';
import { apiService } from '../services/api';
import Pagination from '../components/Pagination';

export default function APIsManagement() {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState({ name: '', api_key: '', provider: '', status: 'active' });

  const fetchApis = async (p = page, pp = perPage, force = false) => {
    try {
      setLoading(true);
      const data = await apiService.getAPIs(p, pp, {}, force);
      const items = data.items || [];
      setApis(items);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('Failed to fetch APIs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApis(); }, []);

  useEffect(() => { setPage(1); fetchApis(1, perPage, true); }, [perPage]);

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('admin_token');
      const url = `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/api-keys`;
      
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      setNotification({ show: true, message: 'API key created successfully', type: 'success' });
      setShowModal(false);
      fetchApis();
    } catch (e) {
      setNotification({ show: true, message: 'Operation failed', type: 'error' });
    }
  };

  const openAddModal = () => {
    setFormData({ name: '', api_key: '', provider: '', status: 'active' });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">API Keys Management</h1>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Add API Key
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">API Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Last Used</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-600">Loading...</td></tr>
            ) : apis.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-600">No API keys configured</td></tr>
            ) : (
              apis.map(api => (
                <tr key={api.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{api.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{api.provider}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-mono">{'*'.repeat(20)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      api.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {api.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{api.last_used ? new Date(api.last_used).toLocaleDateString() : 'Never'}</td>
                  <td className="px-6 py-4 text-sm">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => { setPage(p); fetchApis(p, perPage); }} onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchApis(1, pp); }} />

      {showModal && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add API Key">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="OpenAI API"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({...formData, provider: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select provider</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google AI</option>
                <option value="together">Together AI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({...formData, api_key: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono"
                placeholder="sk-..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
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
