const CHARACTER_LIKE_ENDPOINT = (() => {
  const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!rawBase) return '/api/v1/characters/like';
  const normalizedBase = rawBase.replace(/\/+$/, '');
  return `${normalizedBase}/characters/like`;
})();

export default CHARACTER_LIKE_ENDPOINT;
