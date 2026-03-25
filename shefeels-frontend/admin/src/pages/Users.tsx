import { useEffect, useState, useMemo } from 'react';
import { apiService } from '../services/api';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { Modal, ConfirmDialog, FormField, Notification } from '../components/Modal';
import Pagination from '../components/Pagination';
import UserLogsModal from '../components/UserLogsModal';
import { DatePicker } from '../components/DatePicker';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  created_at: string;
  coin_balance?: number;
  total_revenue?: number;
  country?: string;
  city?: string;
  is_email_verified?: boolean;
  subscription_status?: string;
  is_active?: boolean;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 400);

  // Filters
  const [sortBy, setSortBy] = useState('newest');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');

  // Modals
  const [newUserModalOpen, setNewUserModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Forms
  const [newUserForm, setNewUserForm] = useState({ email: '', full_name: '', role: 'user' });
  const [editForm, setEditForm] = useState({ full_name: '', role: '', is_active: true });
  const [addCoinsOpen, setAddCoinsOpen] = useState(false);
  const [coinsToAdd, setCoinsToAdd] = useState('');

  // Notification
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Extract unique countries from users data
  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>();
    users.forEach(u => {
      if (u.country) countries.add(u.country);
    });
    return Array.from(countries).sort();
  }, [users]);

  // Extract unique cities from users data (filtered by selected country if applicable)
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    users.forEach(u => {
      // If a country is selected, only include cities from that country
      if (countryFilter !== 'all') {
        if (u.country !== countryFilter) return;
      }
      if (u.city) cities.add(u.city);
    });
    return Array.from(cities).sort();
  }, [users, countryFilter]);

  const fetchUsers = async (p = page, pp = perPage, forceRefresh = false, searchOverride?: string) => {
    setLoading(true);
    try {
      const searchValue = searchOverride !== undefined ? searchOverride : searchTerm;
      const filterParams: any = {
        search: searchValue || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined
      };

      if (statusFilter === 'active') {
        filterParams.is_active = true;
      } else if (statusFilter === 'banned') {
        filterParams.is_active = false;
      }

      const data = await apiService.getUsers(p, pp, filterParams, forceRefresh);
      console.log('[Users] fetchUsers response:', data);
      const items = (data.items || []) as User[];
      setUsers(items);
      // If there are no client-side filters active, populate filteredUsers immediately
      const noFiltersActive = !searchTerm && roleFilter === 'all' && statusFilter === 'all' && !fromDate && !toDate && countryFilter === 'all' && cityFilter === 'all';
      if (noFiltersActive) {
        setFilteredUsers(items);
      }
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('Failed to load users', e);
      // surface a helpful notification including HTTP status if available
      // @ts-ignore
      const status = e?.response?.status;
      setNotification({ message: `Failed to load users${status ? ` (status ${status})` : ''}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // when filters/search change, reset page and refetch server-side
  useEffect(() => {
    setPage(1);
    const normalized = String(debouncedSearchTerm || '').trim();
    fetchUsers(1, perPage, true, normalized || undefined);
  }, [debouncedSearchTerm, roleFilter, statusFilter, perPage]);

  useEffect(() => {
    let filtered = [...users];

    // Search filter
    if (searchTerm && String(searchTerm).trim() !== '') {
      const term = String(searchTerm).trim().toLowerCase();
      filtered = filtered.filter(u =>
        String(u.email || '').toLowerCase().includes(term) ||
        String(u.full_name || '').toLowerCase().includes(term)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(u => u.is_active === true);
      } else if (statusFilter === 'banned') {
        filtered = filtered.filter(u => u.is_active === false);
      }
    }

    // Date range filter
    if (fromDate) {
      filtered = filtered.filter(u => new Date(u.created_at) >= new Date(fromDate));
    }
    if (toDate) {
      filtered = filtered.filter(u => new Date(u.created_at) <= new Date(toDate));
    }

    // Country filter
    if (countryFilter !== 'all') {
      filtered = filtered.filter(u => u.country === countryFilter);
    }

    // City filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(u => u.city === cityFilter);
    }

    // Sort
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, sortBy, roleFilter, statusFilter, fromDate, toDate, countryFilter, cityFilter]);

  const handleCreateUser = async () => {
    setActionLoading(true);
    try {
      await apiService.createUser(newUserForm);
      setNotification({ message: 'User created successfully', type: 'success' });
      setNewUserModalOpen(false);
      setNewUserForm({ email: '', full_name: '', role: 'user' });
      fetchUsers(page, perPage, true);
    } catch (e) {
      setNotification({ message: 'Failed to create user', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active ?? true
    });
    setAddCoinsOpen(false);
    setCoinsToAdd('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      await apiService.editUser(selectedUser.id, editForm);
      setNotification({ message: 'User updated successfully', type: 'success' });
      setEditModalOpen(false);
      fetchUsers(page, perPage, true);
    } catch (e) {
      setNotification({ message: 'Failed to update user', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCoins = async () => {
    if (!selectedUser || !coinsToAdd) return;
    setActionLoading(true);
    try {
      const res = await apiService.addCoins(selectedUser.id, parseInt(coinsToAdd));
      setNotification({ message: res.message || 'Coins added successfully', type: 'success' });
      // Update local state
      const newBalance = res.new_balance;
      setSelectedUser({ ...selectedUser, coin_balance: newBalance });
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, coin_balance: newBalance } : u));
      setAddCoinsOpen(false);
      setCoinsToAdd('');
    } catch (e) {
      setNotification({ message: 'Failed to add coins', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      await apiService.deleteUser(selectedUser.id);
      setNotification({ message: 'User deleted successfully', type: 'success' });
      setDeleteModalOpen(false);
      fetchUsers(page, perPage, true);
    } catch (e) {
      setNotification({ message: 'Failed to delete user', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 max-w-full">
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">User Management</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => setNewUserModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Sort By ↓</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A-Z</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Roles ↓</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Status ↓</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>

          <div className="flex items-center gap-2">

            <DatePicker
              value={fromDate}
              onChange={(date) => setFromDate(date)}
              placeholder="From"
              className="w-28"
              maxDate={toDate ? new Date(toDate) : undefined}
            />
            <span className="text-gray-400">-</span>
            <DatePicker
              value={toDate}
              onChange={(date) => setToDate(date)}
              placeholder="To"
              className="w-28"
              minDate={fromDate ? new Date(fromDate) : undefined}
            />
          </div>


          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="w-28 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Country ↓</option>
            {uniqueCountries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>

          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">City ↓</option>
            {uniqueCities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setSortBy('newest');
              setRoleFilter('all');
              setStatusFilter('all');
              setFromDate('');
              setToDate('');
              setCountryFilter('all');
              setCityFilter('all');
              setSearchTerm('');
            }}
            className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200"
          >
            Reset Filters
          </button>


        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SL No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>

                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coins</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const slNo = idx + 1 + (page - 1) * perPage;

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{slNo}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-linear-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium text-sm">
                            {getInitials(user.full_name)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {user.full_name || 'No Name'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${user.role === 'admin'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                          }`}>
                          {user.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${user.is_active === true
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                          }`}>
                          {user.is_active === true ? 'Active' : 'Banned'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                          {user.subscription_status || 'Free'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.country || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {user.city || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${user.is_email_verified
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                          }`}>
                          {user.is_email_verified ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.coin_balance || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(user);
                            }}
                            className="text-sm px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                            title="Edit User"
                          >
                            Edit
                          </button>
                          {/* <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(user);
                            setLogsModalOpen(true);
                          }}
                          className="text-sm px-3 py-1 rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                          title="View Activity Logs"
                        >
                          Logs
                        </button> */}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => { setPage(p); fetchUsers(p, perPage); }} onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchUsers(1, pp); }} />

      {/* New User Modal */}
      <Modal
        isOpen={newUserModalOpen}
        onClose={() => setNewUserModalOpen(false)}
        title="Create New User"
        footer={
          <>
            <button
              onClick={() => setNewUserModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateUser}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? 'Creating...' : 'Create User'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Email" required>
            <input
              type="email"
              value={newUserForm.email}
              onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
            />
          </FormField>

          <FormField label="Full Name">
            <input
              type="text"
              value={newUserForm.full_name}
              onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </FormField>





          <FormField label="Role" required>
            <select
              value={newUserForm.role}
              onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit User"
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
              onClick={() => setAddCoinsOpen(!addCoinsOpen)}
              className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 border border-blue-200"
            >
              {addCoinsOpen ? 'Close' : 'Add Coin'}
            </button>
            <button
              onClick={() => handleDeleteClick(selectedUser!)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            >
              Delete User
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Full Name">
            <input
              type="text"
              value={editForm.full_name}
              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter full name"
            />
          </FormField>

          <FormField label="Role" required>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </FormField>

          <FormField label="Status" required>
            <select
              value={editForm.is_active ? 'true' : 'false'}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="true">Active</option>
              <option value="false">Banned</option>
            </select>
          </FormField>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Email:</span> {selectedUser?.email}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Coins:</span> {selectedUser?.coin_balance || 0}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Total Revenue:</span> ${(selectedUser?.total_revenue || 0).toFixed(2)}
            </p>
            {addCoinsOpen && (
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  value={coinsToAdd}
                  onChange={(e) => setCoinsToAdd(e.target.value)}
                  placeholder="Coins"
                  className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={handleAddCoins}
                  disabled={actionLoading || !coinsToAdd}
                  className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                >
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${selectedUser?.email}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={actionLoading}
      />

      {/* User Activity Logs Modal */}
      {selectedUser && (
        <UserLogsModal
          isOpen={logsModalOpen}
          onClose={() => {
            setLogsModalOpen(false);
            setSelectedUser(null);
          }}
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          userName={selectedUser.full_name || selectedUser.email}
        />
      )}
    </div>
  );
}
