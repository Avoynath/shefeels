import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { Modal, ConfirmDialog, FormField, Notification } from '../components/Modal';
import Pagination from '../components/Pagination';

interface Promo {
  promo_id: string;
  promo_name: string;
  coupon: string;
  percent_off: number;
  start_date: string;
  expiry_date: string;
  status: string;
  applied_count: number;
  stripe_promotion_id?: string;
  stripe_coupon_id?: string;
  created_at: string;
  updated_at: string;
}

export default function PromoManagement() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Forms
  const [addForm, setAddForm] = useState({
    promo_name: '',
    coupon: '',
    percent_off: 0,
    start_date: '',
    expiry_date: '',
    status: 'scheduled'
  });
  
  const [editForm, setEditForm] = useState({
    promo_name: '',
    percent_off: 0,
    start_date: '',
    expiry_date: '',
    status: ''
  });

  const fetchPromos = async (p = page, pp = perPage, force = false) => {
    setLoading(true);
    try {
      const data = await apiService.getPromos(p, pp, {}, force);
      const items = data.items || [];
      setPromos(items as Promo[]);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('Failed to load promos', e);
      setNotification({ message: 'Failed to load promos', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromos(); }, []);

  useEffect(() => { setPage(1); fetchPromos(1, perPage, true); }, [perPage]);

  const handleAddClick = () => {
    const now = new Date();
    const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    setAddForm({
      promo_name: '',
      coupon: '',
      percent_off: 0,
      start_date: now.toISOString().slice(0, 16),
      expiry_date: later.toISOString().slice(0, 16),
      status: 'scheduled'
    });
    setAddModalOpen(true);
  };

  const handleAddSubmit = async () => {
    if (!addForm.promo_name.trim() || !addForm.coupon.trim()) {
      setNotification({ message: 'Promo name and coupon code are required', type: 'error' });
      return;
    }
    
    setActionLoading(true);
    try {
      await apiService.createPromo({
        ...addForm,
        coupon: addForm.coupon.toUpperCase(),
        start_date: new Date(addForm.start_date).toISOString(),
        expiry_date: new Date(addForm.expiry_date).toISOString()
      });
      setNotification({ message: 'Promo created successfully', type: 'success' });
      setAddModalOpen(false);
      fetchPromos();
    } catch (e) {
      setNotification({ message: 'Failed to create promo', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (promo: Promo) => {
    setSelectedPromo(promo);
    setEditForm({
      promo_name: promo.promo_name,
      percent_off: promo.percent_off,
      start_date: new Date(promo.start_date).toISOString().slice(0, 16),
      expiry_date: new Date(promo.expiry_date).toISOString().slice(0, 16),
      status: promo.status
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedPromo) return;
    
    setActionLoading(true);
    try {
      await apiService.updatePromo(selectedPromo.promo_id, {
        ...editForm,
        start_date: new Date(editForm.start_date).toISOString(),
        expiry_date: new Date(editForm.expiry_date).toISOString()
      });
      setNotification({ message: 'Promo updated successfully', type: 'success' });
      setEditModalOpen(false);
      fetchPromos();
    } catch (e) {
      setNotification({ message: 'Failed to update promo', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (promo: Promo) => {
    setSelectedPromo(promo);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPromo) return;
    
    setActionLoading(true);
    try {
      // await apiService.deletePromo(selectedPromo.promo_id);
      // TODO: Implement deletePromo API method
      setNotification({ message: 'Delete functionality coming soon', type: 'error' });
      setDeleteModalOpen(false);
      fetchPromos();
    } catch (e) {
      setNotification({ message: 'Failed to delete promo', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Promo Management</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPromos()}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Promo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Promo Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coupon Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Loading promos...
                  </td>
                </tr>
              ) : promos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No promos found
                  </td>
                </tr>
              ) : (
                promos.map(promo => (
                  <tr key={promo.promo_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{promo.promo_name}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 text-xs font-mono font-semibold rounded border bg-blue-50 text-blue-700 border-blue-300">
                        {promo.coupon}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-lg font-bold text-blue-600">{promo.percent_off}%</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(promo.start_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(promo.expiry_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        promo.status === 'active' 
                          ? 'bg-green-100 text-green-700'
                          : promo.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-700'
                          : promo.status === 'expired'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {promo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{promo.applied_count}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(promo)}
                          className="text-sm px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(promo)}
                          className="text-sm px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => { setPage(p); fetchPromos(p, perPage); }} onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchPromos(1, pp); }} />

      {/* Add Promo Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Promo"
        size="lg"
        footer={
          <>
            <button
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleAddSubmit}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? 'Creating...' : 'Create Promo'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Promo Name" required>
            <input
              type="text"
              value={addForm.promo_name}
              onChange={(e) => setAddForm({ ...addForm, promo_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Summer Sale 2025"
            />
          </FormField>

          <FormField label="Coupon Code" required>
            <input
              type="text"
              value={addForm.coupon}
              onChange={(e) => setAddForm({ ...addForm, coupon: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="SUMMER25"
            />
          </FormField>

          <FormField label="Discount Percentage" required>
            <input
              type="number"
              value={addForm.percent_off}
              onChange={(e) => setAddForm({ ...addForm, percent_off: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="25"
              min="0"
              max="100"
              step="0.01"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" required>
              <input
                type="datetime-local"
                value={addForm.start_date}
                onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FormField>

            <FormField label="Expiry Date" required>
              <input
                type="datetime-local"
                value={addForm.expiry_date}
                onChange={(e) => setAddForm({ ...addForm, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </FormField>
          </div>

          <FormField label="Status" required>
            <select
              value={addForm.status}
              onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Edit Promo Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Promo"
        size="lg"
        footer={
          <>
            <button
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleEditSubmit}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedPromo && (
            <>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Coupon Code:</span> <span className="font-mono font-semibold text-blue-700">{selectedPromo.coupon}</span>
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Applied Count:</span> {selectedPromo.applied_count}
                </p>
              </div>

              <FormField label="Promo Name" required>
                <input
                  type="text"
                  value={editForm.promo_name}
                  onChange={(e) => setEditForm({ ...editForm, promo_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </FormField>

              <FormField label="Discount Percentage" required>
                <input
                  type="number"
                  value={editForm.percent_off}
                  onChange={(e) => setEditForm({ ...editForm, percent_off: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date" required>
                  <input
                    type="datetime-local"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </FormField>

                <FormField label="Expiry Date" required>
                  <input
                    type="datetime-local"
                    value={editForm.expiry_date}
                    onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </FormField>
              </div>

              <FormField label="Status" required>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="expired">Expired</option>
                  <option value="disabled">Disabled</option>
                </select>
              </FormField>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Promo"
        message={`Are you sure you want to delete "${selectedPromo?.promo_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
