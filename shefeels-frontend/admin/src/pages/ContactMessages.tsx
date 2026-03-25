import { useEffect, useState } from 'react';
import { Modal, Notification } from '../components/Modal';
import { apiService } from '../services/api';
import Pagination from '../components/Pagination';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  interest: string | null;
  subject: string | null;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function ContactMessages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const fetchMessages = async (p = page, pp = perPage, force = false) => {
    try {
      setLoading(true);
      const data = await apiService.getContactMessages(p, pp, { status: statusFilter !== 'all' ? statusFilter : undefined, search: searchQuery || undefined }, force);
      const items = data.items || [];
      setMessages(items as ContactMessage[]);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('Failed to fetch contact messages:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      // fetch totals per status in parallel (server returns `total` for filtered queries)
      const statuses = ['pending', 'in_progress', 'resolved', 'closed'];
      const promises = statuses.map(s => apiService.getContactMessages(1, 1, { status: s }, true));
      const results = await Promise.all(promises);
      const newCounts: any = {};
      statuses.forEach((s, i) => { newCounts[s] = results[i]?.total || 0; });
      setCounts(newCounts);
      // also refresh overall total
      const overall = await apiService.getContactMessages(1, 1, {}, true);
      setTotal(overall.total || 0);
    } catch (e) {
      console.error('Failed to fetch contact message counts:', e);
    }
  };

  useEffect(() => { fetchMessages(); }, []);

  useEffect(() => { fetchCounts(); }, []);

  useEffect(() => {
    // when filters/search/page/perPage change, fetch from server
    setPage(1);
    fetchMessages(1, perPage, true);
  }, [statusFilter]);

  useEffect(() => {
    // search triggers server fetch
    setPage(1);
    fetchMessages(1, perPage, true);
  }, [searchQuery, perPage]);

  useEffect(() => {
    let filtered = [...messages];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.subject || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }
    setFilteredMessages(filtered);
  }, [messages, searchQuery, statusFilter]);

  const handleUpdateStatus = async () => {
    if (!selectedMessage) return;
    
    try {
      const token = localStorage.getItem('hl_token') || localStorage.getItem('admin_token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/admin/contact-messages/${selectedMessage.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus, admin_notes: adminNotes })
      });
      
      if (response.ok) {
        setNotification({ show: true, message: 'Message updated successfully', type: 'success' });
        setShowDetailModal(false);
        fetchMessages();
        fetchCounts();
      } else {
        setNotification({ show: true, message: 'Failed to update message', type: 'error' });
      }
    } catch (e) {
      console.error('Update error:', e);
      setNotification({ show: true, message: 'Failed to update message', type: 'error' });
    }
  };

  const openDetailModal = (message: ContactMessage) => {
    setSelectedMessage(message);
    setNewStatus(message.status);
    setAdminNotes(message.admin_notes || '');
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contact Messages</h1>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-2xl font-bold text-gray-900">{total}</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-sm text-orange-500">Pending</div>
          <div className="text-2xl font-bold text-gray-900">{counts.pending ?? 0}</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-sm text-blue-500">In Progress</div>
          <div className="text-2xl font-bold text-gray-900">{counts.in_progress ?? 0}</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-sm text-green-500">Resolved</div>
          <div className="text-2xl font-bold text-gray-900">{counts.resolved ?? 0}</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-500">Closed</div>
          <div className="text-2xl font-bold text-gray-900">{counts.closed ?? 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Loading...</td></tr>
              ) : filteredMessages.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No messages found</td></tr>
              ) : (
                filteredMessages.map((msg, idx) => (
                  <tr key={msg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{msg.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{msg.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{msg.subject || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        msg.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        msg.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        msg.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(msg.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openDetailModal(msg)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => { setPage(p); fetchMessages(p, perPage); }} onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchMessages(1, pp); }} />

      {/* Detail Modal */}
      {showDetailModal && selectedMessage && (
        <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Message Details">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <p className="text-sm">{selectedMessage.name} ({selectedMessage.email})</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <p className="text-sm">{selectedMessage.subject || '—'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <p className="text-sm whitespace-pre-wrap">{selectedMessage.message}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Add internal notes..."
              />
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button onClick={() => setShowDetailModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdateStatus} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Update</button>
            </div>
          </div>
        </Modal>
      )}

      {notification.show && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ ...notification, show: false })} />
      )}
    </div>
  );
}
