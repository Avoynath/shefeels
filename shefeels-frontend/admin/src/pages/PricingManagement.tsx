import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { Modal, ConfirmDialog, FormField, Notification } from '../components/Modal';

interface PricingPlan {
  plan_id: string;
  plan_name: string;
  pricing_id: string;
  currency: string;
  discount: number;
  price: number;
  billing_cycle: string;
  coin_reward: number;
  status: string;
  updated_at: string;
}

export default function PricingManagement() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPlans, setFilteredPlans] = useState<PricingPlan[]>([]);
  
  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Forms
  const [addForm, setAddForm] = useState({
    plan_name: '',
    pricing_id: '',
    currency: 'USD',
    discount: 0,
    price: 0,
    billing_cycle: 'monthly',
    coin_reward: 0,
    status: 'active'
  });
  
  const [editForm, setEditForm] = useState({
    plan_name: '',
    pricing_id: '',
    currency: 'USD',
    discount: 0,
    price: 0,
    billing_cycle: '',
    coin_reward: 0,
    status: ''
  });

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const [recurring, coinPlans] = await Promise.all([
        apiService.getPricingPlans(),
        apiService.getCoinPricing().catch(() => [])
      ]);
      const merged = [...(recurring || []), ...(coinPlans || [])] as PricingPlan[];
      setPlans(merged);
    } catch (e) {
      console.error('Failed to load pricing plans', e);
      setNotification({ message: 'Failed to load pricing plans', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  useEffect(() => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      setFilteredPlans(plans.filter(p => 
        (p.plan_name || '').toLowerCase().includes(term) ||
        (p.pricing_id || '').toLowerCase().includes(term) ||
        (p.billing_cycle || '').toLowerCase().includes(term)
      ));
    } else {
      setFilteredPlans(plans);
    }
  }, [plans, searchTerm]);

  const handleAddClick = () => {
    setAddForm({
      plan_name: '',
      pricing_id: '',
      currency: 'USD',
      discount: 0,
      price: 0,
      billing_cycle: 'monthly',
      coin_reward: 0,
      status: 'active'
    });
    setAddModalOpen(true);
  };

  const handleAddSubmit = async () => {
    if (!addForm.plan_name || !addForm.pricing_id) {
      setNotification({ message: 'Plan name and pricing ID are required', type: 'error' });
      return;
    }
    
    setActionLoading(true);
    try {
      await apiService.createPricingPlan(addForm as any);
      setNotification({ message: 'Plan created successfully', type: 'success' });
      setAddModalOpen(false);
      fetchPlans();
    } catch (e) {
      setNotification({ message: 'Failed to create plan', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setEditForm({
      plan_name: plan.plan_name,
      pricing_id: plan.pricing_id,
      currency: plan.currency,
      discount: plan.discount,
      price: plan.price,
      billing_cycle: plan.billing_cycle,
      coin_reward: plan.coin_reward,
      status: plan.status
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedPlan) return;
    
    setActionLoading(true);
    try {
      await apiService.updatePricingPlan(selectedPlan.plan_id, editForm as any);
      setNotification({ message: 'Plan updated successfully', type: 'success' });
      setEditModalOpen(false);
      fetchPlans();
    } catch (e) {
      setNotification({ message: 'Failed to update plan', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedPlan) return;
    
    setActionLoading(true);
    try {
      await apiService.deletePricingPlan(selectedPlan.pricing_id);
      setNotification({ message: 'Pricing plan deleted successfully', type: 'success' });
      setDeleteModalOpen(false);
      fetchPlans();
    } catch (e) {
      setNotification({ message: 'Failed to delete plan', type: 'error' });
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
        <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Plan
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pricing ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coin Reward</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing cycle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    Loading plans...
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    No pricing plans found
                  </td>
                </tr>
              ) : (
                filteredPlans.map(plan => (
                  <tr key={plan.plan_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{plan.plan_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{plan.currency}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{plan.pricing_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{plan.discount}%</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">${plan.price}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">${plan.coin_reward}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">{plan.billing_cycle}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        plan.status === 'active' 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {plan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" onClick={() => handleEditClick(plan)}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Plan Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add New Plan"
        size="lg"
        footer={
          <>
            <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" disabled={actionLoading}>Cancel</button>
            <button onClick={handleAddSubmit} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {actionLoading ? 'Creating...' : 'Create Plan'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Plan Name" required>
            <input type="text" value={addForm.plan_name} onChange={(e) => setAddForm({ ...addForm, plan_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Pricing ID" required>
            <input type="text" value={addForm.pricing_id} onChange={(e) => setAddForm({ ...addForm, pricing_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Currency">
            <select value={addForm.currency} onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </FormField>
          <FormField label="Price">
            <input type="number" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Discount %">
            <input type="number" value={addForm.discount} onChange={(e) => setAddForm({ ...addForm, discount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Coin Reward">
            <input type="number" value={addForm.coin_reward} onChange={(e) => setAddForm({ ...addForm, coin_reward: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Billing Cycle">
            <select value={addForm.billing_cycle} onChange={(e) => setAddForm({ ...addForm, billing_cycle: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </FormField>
          <FormField label="Status">
            <select value={addForm.status} onChange={(e) => setAddForm({ ...addForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Edit Plan Modal - Similar structure */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Plan"
        size="lg"
        footer={
          <>
            <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" disabled={actionLoading}>Cancel</button>
            <button onClick={() => handleDeleteClick(selectedPlan!)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            <button onClick={handleEditSubmit} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Plan Name">
            <input type="text" value={editForm.plan_name} onChange={(e) => setEditForm({ ...editForm, plan_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Pricing ID">
            <input type="text" value={editForm.pricing_id} onChange={(e) => setEditForm({ ...editForm, pricing_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Price">
            <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Discount %">
            <input type="number" value={editForm.discount} onChange={(e) => setEditForm({ ...editForm, discount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Coin Reward">
            <input type="number" value={editForm.coin_reward} onChange={(e) => setEditForm({ ...editForm, coin_reward: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </FormField>
          <FormField label="Status">
            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Plan"
        message={`Are you sure you want to delete "${selectedPlan?.plan_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
