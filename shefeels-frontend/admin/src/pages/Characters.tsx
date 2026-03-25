import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { ConfirmDialog, Notification } from '../components/Modal';
import CreateCharacterModal from '../components/CreateCharacterModal';
import useDebouncedValue from '../hooks/useDebouncedValue';

interface Character {
  id: string;
  name: string;
  age: string;
  style: string;
  ethnicity: string;
  eye_colour: string;
  hair_colour: string;
  hair_style: string;
  body_type: string;
  breast_size?: string;
  creator_role: string;
  user_id: string;
  email_id?: string;
  image_url_s3?: string;
  created_at: string;
  updated_at: string;
}

export default function Characters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [filteredCharacters, setFilteredCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
  const [characterNameSearchTerm, setCharacterNameSearchTerm] = useState('');
  const debouncedEmailSearchTerm = useDebouncedValue(emailSearchTerm, 400);
  const debouncedCharacterNameSearchTerm = useDebouncedValue(characterNameSearchTerm, 400);
  const [createdByFilter, setCreatedByFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [presignedUrls, setPresignedUrls] = useState<Record<string, string>>({});

  // Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Character> | null>(null);

  const fetchCharacters = async (p: number = page, pp: number = perPage, opts: { search?: string; character_name?: string; created_by?: string; style?: string; gender?: string } = {}) => {
    setLoading(true);
    try {
      const data = await apiService.getCharacters(p, pp, opts);
      const items = (data.items || []) as unknown as Character[];
      setCharacters(items);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);

      // Fetch presigned URLs for images
      const payload: Record<string, string> = {};
      (items as any[]).forEach((char: any) => {
        if (char.image_url_s3) {
          payload[char.id] = char.image_url_s3;
        }
      });

      if (Object.keys(payload).length > 0) {
        const urls = await apiService.getPresignedUrlsByIds(payload);
        setPresignedUrls(urls);
      } else {
        setPresignedUrls({});
      }
    } catch (e) {
      console.error('Failed to load characters', e);
      setNotification({ message: 'Failed to load characters', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCharacters(page, perPage, { search: debouncedEmailSearchTerm || undefined, character_name: debouncedCharacterNameSearchTerm || undefined, created_by: createdByFilter !== 'all' ? createdByFilter : undefined, style: styleFilter !== 'all' ? styleFilter : undefined, gender: genderFilter !== 'all' ? genderFilter : undefined }); }, [page, perPage]);

  // If search or filter changes, reset to page 1 and refetch (debounced)
  useEffect(() => {
    setPage(1);
    const normalizedEmail = String(debouncedEmailSearchTerm || '').trim();
    const normalizedCharName = String(debouncedCharacterNameSearchTerm || '').trim();
    fetchCharacters(1, perPage, { search: normalizedEmail || undefined, character_name: normalizedCharName || undefined, created_by: createdByFilter !== 'all' ? createdByFilter : undefined, style: styleFilter !== 'all' ? styleFilter : undefined, gender: genderFilter !== 'all' ? genderFilter : undefined });
  }, [debouncedEmailSearchTerm, debouncedCharacterNameSearchTerm, createdByFilter, styleFilter, genderFilter, perPage]);

  useEffect(() => {
    // Server returns already filtered page — but keep client-safe filter for legacy
    let filtered = [...characters];
    // Client-side email filter
    if (emailSearchTerm && String(emailSearchTerm).trim() !== '') {
      const term = String(emailSearchTerm).trim().toLowerCase();
      filtered = filtered.filter(c =>
        String(c.email_id || '').toLowerCase().includes(term)
      );
    }
    // Client-side character name filter
    if (characterNameSearchTerm && String(characterNameSearchTerm).trim() !== '') {
      const term = String(characterNameSearchTerm).trim().toLowerCase();
      filtered = filtered.filter(c =>
        String(c.name || '').toLowerCase().includes(term)
      );
    }
    if (createdByFilter !== 'all') {
      filtered = filtered.filter(c => c.creator_role === createdByFilter);
    }
    if (styleFilter !== 'all') {
      filtered = filtered.filter(c => String(c.style || '').toLowerCase() === String(styleFilter).toLowerCase());
    }
    if (genderFilter !== 'all') {
      filtered = filtered.filter(c => String((c as any).gender || '').toLowerCase() === String(genderFilter).toLowerCase());
    }
    setFilteredCharacters(filtered);
  }, [characters, emailSearchTerm, characterNameSearchTerm, createdByFilter, styleFilter, genderFilter]);

  const handleDeleteClick = (character: Character) => {
    setSelectedCharacter(character);
    setDeleteModalOpen(true);
  };

  const handleEditClick = (character: Character) => {
    setSelectedCharacter(character);
    // prefill minimal editable fields
    setEditForm({ name: character.name, age: character.age, style: character.style, ethnicity: character.ethnicity, body_type: character.body_type });
    setEditModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCharacter) return;

    setActionLoading(true);
    try {
      await apiService.deleteCharacter(selectedCharacter.id);
      setNotification({ message: 'Character deleted successfully', type: 'success' });
      setDeleteModalOpen(false);
      fetchCharacters(page, perPage, { search: debouncedEmailSearchTerm || undefined, character_name: debouncedCharacterNameSearchTerm || undefined, created_by: createdByFilter !== 'all' ? createdByFilter : undefined, style: styleFilter !== 'all' ? styleFilter : undefined, gender: genderFilter !== 'all' ? genderFilter : undefined });
    } catch (e) {
      setNotification({ message: 'Failed to delete character', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCharacter || !editForm) return;
    setActionLoading(true);
    try {
      // apiService.editCharacter(characterId, payload)
      const payload: any = {
        character_id: selectedCharacter.id,
        name: editForm.name,
        age: editForm.age,
        style: editForm.style,
        ethnicity: editForm.ethnicity,
        body_type: editForm.body_type
      };
      await (apiService as any).editCharacter(selectedCharacter.id, payload);
      setNotification({ message: 'Character updated successfully', type: 'success' });
      setEditModalOpen(false);
      {
        const normalizedEmail = String(emailSearchTerm || '').trim();
        const normalizedCharName = String(characterNameSearchTerm || '').trim();
        fetchCharacters(page, perPage, { search: normalizedEmail || undefined, character_name: normalizedCharName || undefined, created_by: createdByFilter !== 'all' ? createdByFilter : undefined, style: styleFilter !== 'all' ? styleFilter : undefined, gender: genderFilter !== 'all' ? genderFilter : undefined });
      }
    } catch (e) {
      console.error('Failed to update character', e);
      setNotification({ message: 'Failed to update character', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || '?';
  };

  const resetFilters = () => {
    setEmailSearchTerm('');
    setCharacterNameSearchTerm('');
    setCreatedByFilter('all');
    setStyleFilter('all');
    setGenderFilter('all');
    setPage(1);
    fetchCharacters(1, perPage, {});
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
        <h1 className="text-2xl font-bold text-gray-900">Character Management</h1>
        <div className="flex items-center gap-3">
          {/* Email Search */}
          <div className="relative">
            <input
              type="text"
              value={emailSearchTerm}
              onChange={(e) => setEmailSearchTerm(e.target.value)}
              placeholder="Search by email"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => fetchCharacters(page, perPage, { search: debouncedEmailSearchTerm || undefined, character_name: debouncedCharacterNameSearchTerm || undefined, created_by: createdByFilter !== 'all' ? createdByFilter : undefined, style: styleFilter !== 'all' ? styleFilter : undefined, gender: genderFilter !== 'all' ? genderFilter : undefined })}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <select
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Creators</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>

          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Styles</option>
            <option value="realistic">Realistic</option>
            <option value="anime">Anime</option>
          </select>

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="trans">Trans</option>
          </select>

          {/* Character Name Search */}
          <div className="relative">
            <input
              type="text"
              value={characterNameSearchTerm}
              onChange={(e) => setCharacterNameSearchTerm(e.target.value)}
              placeholder="Search by name"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Character</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading characters...
                  </td>
                </tr>
              ) : filteredCharacters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No characters found
                  </td>
                </tr>
              ) : (
                filteredCharacters.map(char => (
                  <tr key={char.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {presignedUrls[char.id] ? (
                          <img
                            src={presignedUrls[char.id]}
                            alt={char.name}
                            className="w-20 h-20 rounded-lg object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-20 h-20 rounded-lg bg-linear-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-medium text-2xl ${presignedUrls[char.id] ? 'hidden' : ''}`}>
                          {getInitials(char.name)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{char.name}</p>
                          <p className="text-xs text-gray-600">Age: {char.age} • {char.style}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-0.5">
                        <p><span className="font-medium">Ethnicity:</span> {char.ethnicity}</p>
                        <p><span className="font-medium">Eyes:</span> {char.eye_colour}</p>
                        <p><span className="font-medium">Hair:</span> {char.hair_colour} {char.hair_style}</p>
                        <p><span className="font-medium">Body:</span> {char.body_type}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${char.creator_role === 'admin'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                        }`}>
                        {char.creator_role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {char.email_id || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(char.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(char)}
                          className="text-sm px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(char)}
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

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">
          Showing {Math.min((page - 1) * perPage + 1, total || 0)} - {Math.min(page * perPage, total || 0)} of {total}
        </div>

        <div className="flex items-center gap-2">
          <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} className="px-3 py-1 border rounded">
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>

          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>

            {(() => {
              const pages: number[] = [];
              const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
              const start = Math.max(1, page - 3);
              const end = Math.min(totalPages, page + 3);
              for (let i = start; i <= end; i++) pages.push(i);
              return pages.map(p => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 border rounded ${p === page ? 'bg-blue-600 text-white' : ''}`}>{p}</button>
              ));
            })()}

            <button disabled={(page * perPage) >= (total || 0)} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Character"
        message={`Are you sure you want to delete "${selectedCharacter?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={actionLoading}
      />

      {/* Edit / Create Character Modal (migrated) */}
      <CreateCharacterModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editCharacter={selectedCharacter}
        onSuccess={() => {
          setNotification({ message: 'Character saved', type: 'success' });
          {
            const normalizedEmail = String(emailSearchTerm || '').trim();
            const normalizedCharName = String(characterNameSearchTerm || '').trim();
            fetchCharacters(page, perPage, { search: normalizedEmail || undefined, character_name: normalizedCharName || undefined, created_by: createdByFilter !== 'all' ? createdByFilter : undefined, style: styleFilter !== 'all' ? styleFilter : undefined, gender: genderFilter !== 'all' ? genderFilter : undefined });
          }
        }}
      />
    </div>
  );
}
