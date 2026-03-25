import { useEffect, useState } from 'react';
import { Modal, ConfirmDialog } from './Modal';
import { apiService } from '../services/api';

interface UserLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName: string;
}

type LogType = 'all' | 'chat' | 'generation';

interface ChatLog {
  id: string;
  session_id: string;
  character_id: string;
  character_name: string;
  user_query: string;
  ai_message: string;
  transcription: string;
  media_type: string;
  media_urls: any;
  is_media_available: boolean;
  created_at: string;
}

interface GenerationLog {
  id: string;
  character_id: string;
  character_name: string;
  generation_type: string;
  prompt_text: string;
  prompt_metadata: any;
  ai_model: string;
  num_generations: number;
  size_orientation: string;
  status: string;
  error_message: string;
  face_swap_applied: boolean;
  is_compliant: boolean;
  moderation_notes: string;
  source_context: string;
  generated_content_urls: string[];
  created_at: string;
}

export default function UserLogsModal({ isOpen, onClose, userId, userEmail, userName }: UserLogsModalProps) {
  const [activeTab, setActiveTab] = useState<LogType>('all');
  const [loading, setLoading] = useState(false);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [generationLogs, setGenerationLogs] = useState<GenerationLog[]>([]);
  const [totalChats, setTotalChats] = useState(0);
  const [totalGenerations, setTotalGenerations] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState<string>('');
  const [searchPending, setSearchPending] = useState<string>('');
  
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'chat' | 'generation'; id: string; description: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchLogs(activeTab, 1, searchPending);
    }
  }, [isOpen, activeTab]);

  const fetchLogs = async (logType: LogType, currentPage: number, searchText?: string) => {
    setLoading(true);
    try {
      const data = await apiService.getUserActivityLogs(userId, logType, currentPage, pageSize, searchText || undefined);

      // Update chat logs/count only when the server returns them,
      // or clear them if we specifically requested the 'chat' tab and got nothing.
      if (data.chat_logs) {
        setChatLogs(data.chat_logs.logs || []);
        setTotalChats(data.chat_logs.total || 0);
      } else if (logType === 'chat') {
        setChatLogs([]);
        setTotalChats(0);
      }

      // Update generation logs/count only when the server returns them,
      // or clear them if we specifically requested the 'generation' tab and got nothing.
      if (data.generation_logs) {
        setGenerationLogs(data.generation_logs.logs || []);
        setTotalGenerations(data.generation_logs.total || 0);
      } else if (logType === 'generation') {
        setGenerationLogs([]);
        setTotalGenerations(0);
      }
    } catch (error) {
      console.error('Failed to fetch user logs:', error);
      setNotification({ message: 'Failed to load user logs', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchPending(search);
      setPage(1);
      fetchLogs(activeTab, 1, search);
    }, 450);
    return () => clearTimeout(t);
  }, [search]);

  const handleTabChange = (tab: LogType) => {
    setActiveTab(tab);
    setPage(1);
    setExpandedItems(new Set());
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(activeTab, newPage);
  };

  const handleDeleteClick = (type: 'chat' | 'generation', id: string, description: string) => {
    setDeleteTarget({ type, id, description });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'chat') {
        await apiService.deleteUserChatLog(userId, deleteTarget.id);
      } else {
        await apiService.deleteUserGenerationLog(userId, deleteTarget.id);
      }
      
      setNotification({ message: 'Log deleted successfully', type: 'success' });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      
      // Refresh logs
      fetchLogs(activeTab, page);
    } catch (error) {
      console.error('Failed to delete log:', error);
      setNotification({ message: 'Failed to delete log', type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const truncate = (text: string, maxLength: number) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const totalPages = Math.ceil(
    (activeTab === 'chat' ? totalChats : activeTab === 'generation' ? totalGenerations : Math.max(totalChats, totalGenerations)) / pageSize
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Activity Logs - ${userName || userEmail}`}
        size="xl"
      >
        <div className="space-y-3">
          {notification && (
            <div className={`p-2 rounded text-sm ${notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {notification.message}
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => handleTabChange('all')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Activity
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                  {totalChats + totalGenerations}
                </span>
              </button>
              <button
                onClick={() => handleTabChange('chat')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'chat'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Chat Messages
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                  {totalChats}
                </span>
              </button>
              <button
                onClick={() => handleTabChange('generation')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'generation'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AI Generations
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                  {totalGenerations}
                </span>
              </button>
            </nav>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages or prompts"
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
            />
          </div>

          {/* Content */}
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto border border-gray-200 rounded">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Chat Logs */}
                {(activeTab === 'all' || activeTab === 'chat') && chatLogs.length > 0 && (
                  <div className="mb-4">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 sticky top-0">
                      <h3 className="text-xs font-semibold text-gray-700">
                        Chat Messages ({totalChats})
                      </h3>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 sticky top-8">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Character</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">User Query</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">AI Response</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Type</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Date</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {chatLogs.map((chat) => {
                          const isExpanded = expandedItems.has(chat.id);
                          return (
                            <tr key={chat.id} className="hover:bg-gray-50">
                              <td className="px-2 py-2 text-gray-900 max-w-25">
                                <div className="truncate">{chat.character_name || 'Unknown'}</div>
                              </td>
                              <td 
                                className="px-2 py-2 text-gray-700 max-w-62.5 cursor-pointer hover:bg-blue-50"
                                onClick={() => toggleExpanded(chat.id)}
                              >
                                <div className={isExpanded ? '' : 'line-clamp-2'} title={chat.user_query}>
                                  {chat.user_query}
                                </div>
                              </td>
                              <td 
                                className="px-2 py-2 text-gray-700 max-w-62.5 cursor-pointer hover:bg-blue-50"
                                onClick={() => toggleExpanded(chat.id)}
                              >
                                <div className={isExpanded ? '' : 'line-clamp-2'} title={chat.ai_message}>
                                  {chat.ai_message || '—'}
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                {chat.media_type && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">
                                    {chat.media_type}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-gray-600 whitespace-nowrap text-[10px]">
                                {formatDate(chat.created_at)}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex gap-1.5 flex-wrap">
                                  {chat.media_urls && (
                                    <a 
                                      href={typeof chat.media_urls === 'string' ? chat.media_urls : Object.values(chat.media_urls)[0] as string} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[10px] font-medium transition-colors"
                                    >
                                      👁 View
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleDeleteClick('chat', chat.id, `Chat with ${chat.character_name}`)}
                                    className="px-2 py-0.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-[10px] font-medium transition-colors"
                                  >
                                    🗑 Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Generation Logs */}
                {(activeTab === 'all' || activeTab === 'generation') && generationLogs.length > 0 && (
                  <div>
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 sticky top-0">
                      <h3 className="text-xs font-semibold text-gray-700">
                        AI Generations ({totalGenerations})
                      </h3>
                    </div>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 sticky top-8">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Character</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Type</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">User Input</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Prompt</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Model</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Status</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Date</th>
                          <th className="px-2 py-1.5 text-left font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {generationLogs.map((gen) => {
                          const isExpanded = expandedItems.has(gen.id);
                          const userInput = gen.prompt_metadata?.original_prompt || gen.prompt_text;
                          return (
                            <tr key={gen.id} className="hover:bg-gray-50">
                              <td className="px-2 py-2 text-gray-900 max-w-25">
                                <div className="truncate">{gen.character_name || 'None'}</div>
                              </td>
                              <td className="px-2 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  gen.generation_type === 'image' ? 'bg-purple-100 text-purple-700' :
                                  gen.generation_type === 'voice' ? 'bg-blue-100 text-blue-700' :
                                  gen.generation_type === 'video' ? 'bg-pink-100 text-pink-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {gen.generation_type}
                                </span>
                              </td>
                              <td 
                                className="px-2 py-2 text-gray-700 max-w-50 cursor-pointer hover:bg-blue-50"
                                onClick={() => toggleExpanded(gen.id)}
                              >
                                <div className={isExpanded ? '' : 'line-clamp-2'} title={userInput}>
                                  {userInput || '—'}
                                </div>
                              </td>
                              <td 
                                className="px-2 py-2 text-gray-700 max-w-50 cursor-pointer hover:bg-blue-50"
                                onClick={() => toggleExpanded(gen.id)}
                              >
                                <div className={isExpanded ? '' : 'line-clamp-2'} title={gen.prompt_text}>
                                  {gen.prompt_text || '—'}
                                </div>
                              </td>
                              <td className="px-2 py-2 text-gray-600 text-[10px]">
                                {gen.ai_model || '—'}
                              </td>
                              <td className="px-2 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  gen.status === 'success' ? 'bg-green-100 text-green-700' :
                                  gen.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {gen.status}
                                </span>
                              </td>
                              <td className="px-2 py-2 text-gray-600 whitespace-nowrap text-[10px]">
                                {formatDate(gen.created_at)}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex gap-1.5 flex-wrap">
                                  {gen.generated_content_urls && gen.generated_content_urls.length > 0 && gen.generated_content_urls[0] && (
                                    <a
                                      href={gen.generated_content_urls[0]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-0.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-[10px] font-medium transition-colors"
                                    >
                                      👁 View
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleDeleteClick('generation', gen.id, `${gen.generation_type} generation`)}
                                    className="px-2 py-0.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-[10px] font-medium transition-colors"
                                  >
                                    🗑 Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Empty State */}
                {!loading && chatLogs.length === 0 && generationLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No activity logs found for this user.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
              <div className="text-gray-700">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Log Entry"
        message={`Are you sure you want to delete this ${deleteTarget?.description}? This action cannot be undone and will permanently remove the content.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteLoading}
      />
    </>
  );
}
