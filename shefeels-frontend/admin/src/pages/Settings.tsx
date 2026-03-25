import { useEffect, useState, useMemo } from 'react';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { apiService } from '../services/api';
import { Modal, ConfirmDialog, FormField, Notification } from '../components/Modal';

export default function Settings() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [filteredConfigs, setFilteredConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [formData, setFormData] = useState({ key: '', value: '', description: '', category: '' });

  // Extract unique categories dynamically from configs data
  const categories = useMemo(() => {
    const categorySet = new Set<string>();
    configs.forEach(c => {
      if (c.category) categorySet.add(c.category);
    });
    return Array.from(categorySet).sort();
  }, [configs]);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await apiService.getConfigs();
      const list = Array.isArray(data) ? data : [];
      const mapped = list.map((c: any) => ({
        id: c.id,
        key: c.parameter_name || c.key || c.parameter_name,
        value: c.parameter_value || c.value || c.parameter_value,
        description: c.parameter_description || c.description || c.parameter_description,
        category: c.category || 'General',
        created_at: c.created_at || c.createdAt || c.created_at
      }));
      setConfigs(mapped);
    } catch (e) {
      console.error('getConfigs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  useEffect(() => {
    let filtered = [...configs];
    if (debouncedSearchQuery && String(debouncedSearchQuery).trim() !== '') {
      const q = String(debouncedSearchQuery).trim().toLowerCase();
      filtered = filtered.filter(c =>
        String(c.key || '').toLowerCase().includes(q) ||
        String(c.value || '').toLowerCase().includes(q) ||
        String(c.description || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(c => c.category === categoryFilter);
    }
    // Sort by numeric id (ascending) for stable ordering
    filtered.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    setFilteredConfigs(filtered);
  }, [configs, debouncedSearchQuery, categoryFilter]);

  const handleAdd = async () => {
    try {
      await apiService.createConfig({
        parameter_name: formData.key,
        parameter_value: formData.value,
        parameter_description: formData.description,
        category: formData.category
      });
      setNotification({ show: true, message: 'Configuration added successfully', type: 'success' });
      setShowAddModal(false);
      setFormData({ key: '', value: '', description: '', category: '' });
      fetchConfigs();
    } catch (e) {
      console.error('createConfig', e);
      setNotification({ show: true, message: 'Failed to add configuration', type: 'error' });
    }
  };

  const handleEdit = async () => {
    if (!selectedConfig) return;
    try {
      await apiService.updateConfig(selectedConfig.id, {
        parameter_value: formData.value,
        parameter_description: formData.description
      });
      setNotification({ show: true, message: 'Configuration updated successfully', type: 'success' });
      setShowEditModal(false);
      setSelectedConfig(null);
      fetchConfigs();
    } catch (e) {
      console.error('updateConfig', e);
      setNotification({ show: true, message: 'Failed to update configuration', type: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!selectedConfig) return;
    try {
      await apiService.deleteConfig(selectedConfig.id);
      setNotification({ show: true, message: 'Configuration deleted successfully', type: 'success' });
      setShowDeleteDialog(false);
      setSelectedConfig(null);
      fetchConfigs();
    } catch (e) {
      console.error('deleteConfig', e);
      setNotification({ show: true, message: 'Failed to delete configuration', type: 'error' });
    }
  };

  const openEditModal = (config: any) => {
    setSelectedConfig(config);
    setFormData({ key: config.key, value: config.value, description: config.description || '', category: config.category || 'General' });
    setShowEditModal(true);
  };

  const openDeleteDialog = (config: any) => {
    setSelectedConfig(config);
    setShowDeleteDialog(true);
  };

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Settings & Configuration</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => { setFormData({ key: '', value: '', description: '', category: 'General' }); setShowAddModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Configuration
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">Category ↓</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parameter Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Loading settings...</td></tr>
              ) : filteredConfigs.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No settings found</td></tr>
              ) : (
                filteredConfigs.map((config) => (
                  <tr key={config.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{config.id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{config.key}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{config.value || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-sm truncate">{config.description || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {config.category || 'General'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{config.created_at ? new Date(config.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEditModal(config)} className="px-3 py-1 bg-blue-100 text-blue-600 font-medium rounded hover:bg-blue-200">Edit</button>
                        <button onClick={() => openDeleteDialog(config)} className="px-3 py-1 bg-red-100 text-red-600 font-medium rounded hover:bg-red-200">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <Modal title="Add Configuration" onClose={() => setShowAddModal(false)} size="md" isOpen={showAddModal}>
          <div className="space-y-4">
            <FormField label="Parameter Name" required>
              <input type="text" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. MAX_TOKENS" />
            </FormField>
            <FormField label="Value" required>
              <input type="text" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Configuration value" />
            </FormField>
            <FormField label="Description">
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Configuration description" />
            </FormField>
            <FormField label="Category" required>
              <input
                type="text"
                list="category-options"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Select or type a category"
              />
              <datalist id="category-options">
                {categories.map(cat => <option key={cat} value={cat} />)}
              </datalist>
            </FormField>
            <div className="flex justify-end gap-3 pt-4">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Configuration</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedConfig && (
        <Modal
          title={`Edit Configuration: ${selectedConfig.key}`}
          onClose={() => setShowEditModal(false)}
          size="md"
          isOpen={showEditModal}
          footer={
            <>
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => { openDeleteDialog(selectedConfig); }} className="px-4 py-2 text-sm font-medium text-red-600 bg-red-100 rounded-lg hover:bg-red-200">Delete</button>
              <button onClick={handleEdit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">Save Changes</button>
            </>
          }
        >
          <div className="space-y-4">
            <FormField label="Parameter Name">
              <input type="text" value={formData.key} disabled className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500" />
            </FormField>
            <FormField label="Value" required>
              <input type="text" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </FormField>
            <FormField label="Description">
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </FormField>
            <FormField label="Category" required>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </FormField>
          </div>
        </Modal>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && selectedConfig && (
        <ConfirmDialog
          isOpen={showDeleteDialog}
          title="Delete Configuration"
          message={`Are you sure you want to delete "${selectedConfig.key}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteDialog(false)}
        />
      )}

      {/* Notification */}
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification({ ...notification, show: false })}
        />
      )}
    </div>
  );
}
