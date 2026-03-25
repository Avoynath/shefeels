import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Get the base URL from environment variable
// Get the base URL from environment variable, fallback to relative /api/v1
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || '/api/v1';

interface MediaItem {
  id: string;
  s3_path?: string;
  s3_path_gallery?: string;
  image_s3_url?: string;
  image_url_s3?: string;
  mime_type?: string;
}

export default function PrivateContentPackCreate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { characterId, packId } = (location.state as any) || {};

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [thumbnailId, setThumbnailId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [packName, setPackName] = useState('');
  const [packDescription, setPackDescription] = useState('');
  const [tokens, setTokens] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getMediaUrl = (item: MediaItem): string => {
    return item.s3_path_gallery || item.s3_path || item.image_s3_url || item.image_url_s3 || '';
  };

  const fetchMedia = useCallback(async () => {
    if (!characterId) return;

    setLoading(true);
    try {
      const stored = localStorage.getItem('pornily:auth:token') ||
        localStorage.getItem('pornily:auth:access_token') ||
        localStorage.getItem('access_token');
      const token = stored ? stored.replace(/^bearer\s+/i, '').trim() : null;
      const response = await axios.post(
        `${API_BASE_URL}/admin/private-content/get-character-media`,
        { character_id: characterId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const rawItems = response.data?.media || response.data?.images || response.data?.data || [];
      const normalized = rawItems.map((it: any, idx: number) => ({
        id: it.id || `item-${idx}`,
        s3_path_gallery: it.s3_path_gallery || it.s3_path || it.image_s3_url || it.image_url_s3 || null,
        s3_path: it.s3_path || it.s3_path_gallery || null,
        image_s3_url: it.image_s3_url || it.image_url_s3 || null,
        image_url_s3: it.image_url_s3 || it.image_s3_url || null,
        mime_type: it.mime_type || it.content_type || 'image/*',
        ...it,
      }));

      setItems(normalized);
    } catch (error) {
      console.error('Failed to load media:', error);
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    setUploading(true);

    try {
      const stored = localStorage.getItem('pornily:auth:token') ||
        localStorage.getItem('pornily:auth:access_token') ||
        localStorage.getItem('access_token');
      const token = stored ? stored.replace(/^bearer\s+/i, '').trim() : null;

      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        if (characterId) formData.append('character_id', characterId);

        const response = await axios.post(
          `${API_BASE_URL}/admin/private-content/upload-media-and-add`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        return {
          id: response.data.id,
          s3_path_gallery: response.data.url || response.data.signed_url || response.data.s3_path,
          s3_path: response.data.s3_path || response.data.url,
          image_s3_url: response.data.url || response.data.s3_path,
          image_url_s3: response.data.url || response.data.s3_path,
          mime_type: file.type || 'image/*',
        };
      });

      const newItems = await Promise.all(uploadPromises);

      setItems(prev => [...newItems, ...prev]);
      setSelectedIds(prev => [...new Set([...newItems.map(item => item.id), ...prev])]);
      if (!thumbnailId && newItems.length > 0) setThumbnailId(newItems[0].id);

      toast.success(`${newItems.length} file(s) uploaded successfully`);
    } catch (error) {
      console.error('Failed to upload media:', error);
      toast.error('Failed to upload one or more files');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return Array.from(set);
    });
  };

  const submitPack = async () => {
    if (!packName.trim()) {
      toast.error('Pack name is required');
      return;
    }

    setSubmitting(true);
    try {
      const stored = localStorage.getItem('pornily:auth:token') ||
        localStorage.getItem('pornily:auth:access_token') ||
        localStorage.getItem('access_token');
      const token = stored ? stored.replace(/^bearer\s+/i, '').trim() : null;
      await axios.post(
        `${API_BASE_URL}/admin/private-content/create-pack`,
        {
          character_id: characterId,
          pack_name: packName,
          pack_description: packDescription,
          tokens: Number(tokens) || 0,
          thumbnail_image_id: thumbnailId,
          list_media_ids: selectedIds,
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      toast.success('Pack created successfully');
      navigate('/admin/private-content/packs', { state: { characterId } });
    } catch (error: any) {
      console.error('Failed to create pack:', error);
      toast.error(error.response?.data?.detail || 'Failed to create pack');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Create Pack</h1>

      <div className="flex items-center gap-4">
        <p className="text-gray-700">Select media to include in a pack or upload media to include in a pack</p>
        <label className={`px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {uploading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></span>
              UPLOADING...
            </span>
          ) : (
            "UPLOAD MEDIA"
          )}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} multiple />
        </label>
        <button onClick={fetchMedia} className="px-4 py-2 text-blue-600 hover:text-blue-700">
          REFRESH
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-500">No media found for this character.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className="relative cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow h-48"
              >
                <img
                  src={getMediaUrl(item)}
                  alt={item.id}
                  className="w-full h-full object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                    <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-2xl font-bold">
                      ✓
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => setShowModal(true)}
          disabled={selectedIds.length === 0}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          NEXT
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create Pack</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Thumbnail Image Card (click to choose)</label>
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto border rounded p-2">
                {items.filter(it => selectedIds.includes(it.id)).map((item) => {
                  const isThumb = thumbnailId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setThumbnailId(item.id)}
                      className={`cursor-pointer relative border-2 rounded ${isThumb ? 'border-blue-600' : 'border-gray-200'
                        }`}
                    >
                      <img src={getMediaUrl(item)} alt={item.id} className="w-full h-16 object-cover" />
                      {isThumb && (
                        <div className="absolute top-1 right-1 bg-white rounded-full px-1">✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Pack Name</label>
              <input
                type="text"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="Pack Name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Pack Description</label>
              <textarea
                value={packDescription}
                onChange={(e) => setPackDescription(e.target.value)}
                placeholder="Pack Description"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Token</label>
              <input
                type="number"
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                placeholder="Token"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                CANCEL
              </button>
              <button
                onClick={submitPack}
                disabled={submitting || selectedIds.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'SUBMITTING...' : 'SUBMIT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
