import { useEffect, useState } from 'react';
import useDebouncedValue from '../hooks/useDebouncedValue';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Character {
  id: string;
  name: string;
  age?: number;
  style?: string;
  gender?: string;
  image_url_s3?: string;
  bio?: string;
}

export default function PrivateContent() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 350);
  const [styleFilter, setStyleFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  const fetchCharacters = async (p: number = page, pp: number = perPage, opts: { search?: string; style?: string; gender?: string } = {}) => {
    try {
      setLoading(true);
      const data = await apiService.getDefaultCharacters(p, pp, opts);
      setCharacters(data.items || []);
      setTotal(data.total || 0);
      setPage(data.page || p);
      setPerPage(data.per_page || pp);
    } catch (error) {
      console.error('Failed to fetch characters:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharacters(page, perPage, {
      search: debouncedSearchQuery || undefined,
      style: styleFilter !== 'all' ? styleFilter : undefined,
      gender: genderFilter !== 'all' ? genderFilter : undefined,
    });
  }, [page, perPage]);

  useEffect(() => {
    setPage(1);
    fetchCharacters(1, perPage, {
      search: debouncedSearchQuery || undefined,
      style: styleFilter !== 'all' ? styleFilter : undefined,
      gender: genderFilter !== 'all' ? genderFilter : undefined,
    });
  }, [debouncedSearchQuery, styleFilter, genderFilter, perPage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Private Content</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or bio"
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => fetchCharacters(page, perPage, {
              search: debouncedSearchQuery || undefined,
              style: styleFilter !== 'all' ? styleFilter : undefined,
              gender: genderFilter !== 'all' ? genderFilter : undefined,
            })}
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
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : characters.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {searchQuery ? `No characters found for "${String(searchQuery).trim()}"` : 'No characters found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {characters.map((character) => (
            <div
              key={character.id}
              onClick={() => navigate('/admin/private-content/packs', { state: { characterId: character.id } })}
              className="relative group cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow"
            >
              <div className="aspect-2/3 relative overflow-hidden bg-gray-200">
                {character.image_url_s3 ? (
                  <img
                    src={character.image_url_s3}
                    alt={character.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-6xl font-bold">
                      {character.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/60 to-transparent p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-lg truncate">{character.name}</h3>
                  {character.age && (
                    <span className="text-white text-sm ml-2 shrink-0">{character.age}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-600">
            Showing {Math.min((page - 1) * perPage + 1, total)} - {Math.min(page * perPage, total)} of {total}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>

            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 text-sm"
              >
                Prev
              </button>

              {(() => {
                const pages: number[] = [];
                const totalPages = Math.max(1, Math.ceil(total / perPage));
                const start = Math.max(1, page - 3);
                const end = Math.min(totalPages, page + 3);
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 border rounded text-sm ${
                      p === page ? 'bg-blue-600 text-white' : ''
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                disabled={page * perPage >= total}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 border rounded disabled:opacity-50 text-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
