// Utility to normalize character objects from various backend shapes
export function normalizeCharacter(raw: any) {
  if (!raw || typeof raw !== 'object') return raw;

  // Only normalize when an explicit `username` field is present. Do not derive from social/profile/handle
  const usernameRaw = typeof raw.username === 'string' ? raw.username : '';
  const username = typeof usernameRaw === 'string' ? usernameRaw.trim().replace(/^@+/, '') : '';

  const image_url_s3 = raw.image_url_s3 || raw.image_url || raw.imageUrl || null;

  // Normalize gender and style fields from various backend shapes
  const genderRaw = raw.gender || raw.sex || raw.gender_identity || raw.gender_identity_label || '';
  const gender = typeof genderRaw === 'string' ? genderRaw.trim() : '';

  const styleRaw = raw.style || raw.art_style || raw.image_style || raw.type || '';
  const style = typeof styleRaw === 'string' ? styleRaw.trim() : '';

  // Map known social URL fields from backend to a unified `social` object
  const social = {
    onlyfans: raw.onlyfans_url || raw.onlyfansUrl || raw.onlyfans || null,
    fanvue: raw.fanvue_url || raw.fanvueUrl || raw.fanvue || null,
    tiktok: raw.tiktok_url || raw.tiktokUrl || raw.tiktok || null,
    instagram: raw.instagram_url || raw.instagramUrl || raw.instagram || null,
  } as any;

  return {
    ...raw,
    username,
    image_url_s3,
    gender,
    style,
    social,
  };
}

export function normalizeCharacters(items: any[]) {
  return (items || []).map((it) => normalizeCharacter(it));
}
