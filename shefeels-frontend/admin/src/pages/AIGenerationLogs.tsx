import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import Pagination from '../components/Pagination';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { DatePicker } from '../components/DatePicker';

export default function AIGenerationLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 400);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = async (p = page, pp = perPage, force = false, searchOverride?: string) => {
    try {
      setLoading(true);
      const filters: any = {};
      const searchValue = searchOverride !== undefined ? searchOverride : searchQuery;
      if (searchValue) filters.search = searchValue;
      if (typeFilter !== 'all') filters.generation_type = typeFilter;
      if (fromDate) filters.start_date = fromDate;
      if (toDate) filters.end_date = toDate;
      const data = await apiService.getAIGenerationLogs(p, pp, filters, force);
      const items = data.items || [];
      setLogs(items);
      setFilteredLogs(items); // Set filtered logs directly from server response
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (e) {
      console.error('Failed to fetch AI logs:', e);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (logId: string) => {
    if (!confirm('⚠️ WARNING: This will permanently delete the generated content from S3 and cannot be undone.\n\nAre you sure you want to continue?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/v1/admin/ai-generations/logs/${logId}/delete`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Content deleted successfully');
      fetchLogs(page, perPage, true); // Refresh the list
    } catch (error: any) {
      console.error('Failed to delete content:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete content');
    }
  };

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedRows(newExpanded);
  };

  useEffect(() => { fetchLogs(); }, []);

  // When filters change, reset to page 1 and refetch from server
  useEffect(() => {
    setPage(1);
    const normalized = String(debouncedSearchQuery || '').trim();
    fetchLogs(1, perPage, true, normalized || undefined);
  }, [debouncedSearchQuery, typeFilter, perPage, fromDate, toDate]);

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Content Management</h1>
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

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="all">All Types</option>
            <option value="image">Image</option>
            <option value="voice">Voice</option>
            <option value="video">Video</option>
            <option value="chat">Chat</option>
          </select>
          <DatePicker value={fromDate} onChange={(date) => setFromDate(date)} placeholder="From Date" className="w-36" maxDate={toDate ? new Date(toDate) : undefined} />
          <DatePicker value={toDate} onChange={(date) => setToDate(date)} placeholder="To Date" className="w-36" minDate={fromDate ? new Date(fromDate) : undefined} />
          {(searchQuery || typeFilter !== 'all' || fromDate || toDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setFromDate('');
                setToDate('');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">S.No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Character</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Input</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500">Loading logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500">No logs found</td></tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const isExpanded = expandedRows.has(log.id);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{(page - 1) * perPage + idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-medium">{log.user?.email || '—'}</span>
                          <span className="text-xs text-gray-500">{log.user?.full_name || ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.character?.name || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${log.generation_type === 'image' ? 'bg-purple-100 text-purple-700' :
                          log.generation_type === 'voice' ? 'bg-blue-100 text-blue-700' :
                            log.generation_type === 'video' ? 'bg-pink-100 text-pink-700' :
                              'bg-green-100 text-green-700'
                          }`}>
                          {log.generation_type || 'unknown'}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-600 max-w-xs cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => toggleExpanded(log.id)}
                        title={isExpanded ? 'Click to collapse' : 'Click to expand'}
                      >
                        <div className={isExpanded ? 'whitespace-pre-wrap' : 'truncate'}>
                          {log.prompt_metadata?.original_prompt || log.prompt_text || '—'}
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-600 max-w-xs cursor-pointer hover:bg-blue-50 transition-colors"
                        onClick={() => toggleExpanded(log.id)}
                        title={isExpanded ? 'Click to collapse' : 'Click to expand'}
                      >
                        <div className={isExpanded ? 'whitespace-pre-wrap' : 'truncate'}>
                          {log.prompt_text || '—'}
                        </div>
                        {log.source_context && (
                          <span className="text-xs text-gray-400 block mt-1">({log.source_context})</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.ai_model || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-700' :
                          log.status === 'failed' ? 'bg-red-100 text-red-700' :
                            log.status === 'deleted' ? 'bg-gray-100 text-gray-700' :
                              'bg-yellow-100 text-yellow-700'
                          }`}>
                          {log.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {log.generated_content_urls && log.generated_content_urls.length > 0 && (
                            <a
                              href={log.generated_content_urls[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-xs"
                            >
                              View
                            </a>
                          )}
                          {log.status !== 'deleted' && (
                            <button
                              onClick={() => handleDeleteContent(log.id)}
                              className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs transition-colors"
                            >
                              Delete
                            </button>
                          )}
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

      <Pagination page={page} perPage={perPage} total={total} onPageChange={(p) => { setPage(p); fetchLogs(p, perPage); }} onPerPageChange={(pp) => { setPerPage(pp); setPage(1); fetchLogs(1, pp); }} />
    </div>
  );
}
