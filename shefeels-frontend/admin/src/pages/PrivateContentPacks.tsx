import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';

interface Pack {
  id: string;
  name: string;
  description?: string;
  price_tokens?: number;
  num_videos?: number;
  num_images?: number;
  thumbnail_s3_path?: string | null;
  presigned_thumbnail_s3_path?: string | null;
  character_id?: string;
}

export default function PrivateContentPacks() {
  const location = useLocation();
  const navigate = useNavigate();
  // Match legacy: prefer navigation state, fall back to query param
  const stateAny = (location.state || {}) as any;
  const qs = new URLSearchParams(location.search || '');
  const characterId = stateAny.characterId ?? qs.get('characterId') ?? null;

  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPacks = async () => {
    if (!characterId) {
      setPacks([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Use the updated API that accepts list of character_ids and returns character_id -> packs mapping
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const url = base + '/private-content/get-pack';
      const headers: Record<string, string> = {};
      try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('pornily:auth:token') : null;
        if (stored) {
          const tokenOnly = stored.replace(/^bearer\s+/i, '').trim();
          headers['Authorization'] = `bearer ${tokenOnly}`;
        }
      } catch (e) {
        // ignore
      }
      // New payload: list of character_ids
      // New response: array of dicts, each mapping character_id -> packs
      // e.g., [{ "char_id_1": [...packs] }, { "char_id_2": [...packs] }]
      const response = await axios.post<Array<Record<string, Pack[]>>>(url, { character_ids: [characterId] }, { headers });
      const responseData = response.data || [];
      // Find packs for our character_id by searching through the array of dictionaries
      let characterPacks: Pack[] = [];
      if (Array.isArray(responseData)) {
        for (const item of responseData) {
          if (item && typeof item === 'object' && characterId in item) {
            characterPacks = item[characterId] || [];
            break;
          }
        }
      }
      setPacks(Array.isArray(characterPacks) ? characterPacks : []);
    } catch (e: any) {
      console.error('Failed to load packs:', e);
      setError(e?.message || 'Failed to load packs');
      toast.error('Failed to load packs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacks();
  }, [characterId]);

  const handleDelete = async (packId: string) => {
    if (!confirm('Delete this pack? This action cannot be undone.')) return;

    try {
      // Match legacy admin: build full URL with proper headers
      const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const url = base + '/admin/private-content/delete-pack';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('hl_token') || localStorage.getItem('pornily:auth:token') : null;
        if (stored) headers['Authorization'] = `Bearer ${String(stored).replace(/^bearer\s+/i, '').trim()}`;
      } catch (e) { }
      await axios.post(url, { pack_id: packId }, { headers });
      toast.success('Pack deleted successfully');
      setPacks(packs.filter(p => p.id !== packId));
    } catch (error: any) {
      console.error('Failed to delete pack:', error);
      setError(error?.message || 'Failed to delete pack');
      toast.error(error.response?.data?.detail || 'Failed to delete pack');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Private Content Packs</h1>
          {characterId && (
            <p className="text-sm text-gray-500 mt-1">Character: {characterId}</p>
          )}
        </div>
        <button
          onClick={() => navigate('/admin/private-content/packs/create', { state: { characterId } })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          CREATE PACK
        </button>
      </div>

      {!characterId ? (
        <div className="text-center py-20 text-gray-500">
          <p>Select a character to view packs.</p>
          <p className="text-sm mt-2">Navigate from the Private Content → Characters list, or append <code>?characterId=&lt;id&gt;</code> to the URL.</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-600">{error}</div>
      ) : packs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No packs found for this character.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {packs.map((pack) => (
            <div
              key={pack.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow relative group"
            >
              {/* Action buttons overlay */}
              <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/admin/private-content/packs/create', { state: { characterId, packId: pack.id } });
                  }}
                  className="px-3 py-1 bg-white text-blue-600 border border-blue-600 rounded hover:bg-blue-50 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(pack.id);
                  }}
                  className="px-3 py-1 bg-white text-red-600 border border-red-600 rounded hover:bg-red-50 text-sm"
                >
                  Delete
                </button>
              </div>

              <div
                onClick={() => navigate('/admin/private-content/packs/create', { state: { characterId, packId: pack.id } })}
                className="cursor-pointer"
              >
                {pack.presigned_thumbnail_s3_path || pack.thumbnail_s3_path ? (
                  <img
                    src={pack.presigned_thumbnail_s3_path || pack.thumbnail_s3_path || ''}
                    alt={pack.name}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}

                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{pack.name}</h3>
                  {pack.price_tokens !== undefined && (
                    <p className="text-sm text-gray-600 mb-2">{pack.price_tokens} Tokens</p>
                  )}
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>Videos: {pack.num_videos || 0}</span>
                    <span>Images: {pack.num_images || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
