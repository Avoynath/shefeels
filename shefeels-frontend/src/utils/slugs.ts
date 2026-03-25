/**
 * Utility functions for generating and parsing URL slugs for characters and packs.
 * 
 * Format: {kebab-name}-{shortId}
 * Example: luna-guide-9f3b12a4
 */

/**
 * Generate a short ID from a full ID (first 8 characters)
 */
export function getShortId(fullId: string | number): string {
  const id = String(fullId || '');
  return id.slice(0, 8);
}

/**
 * Convert a string to kebab-case (lowercase, spaces/special chars to hyphens)
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a slug from a name and ID
 * @param name - The display name (e.g., "Luna Guide")
 * @param id - The full ID (e.g., "9f3b12a4b5c6...")
 * @returns Slug in format: {kebab-name}-{shortId}
 */
export function generateSlug(name: string, id: string | number): string {
  const kebabName = toKebabCase(name || 'item');
  const shortId = getShortId(id);
  
  // Ensure we have both parts
  if (!kebabName || !shortId) {
    return shortId || 'unknown';
  }
  
  return `${kebabName}-${shortId}`;
}

/**
 * Parse a slug to extract the short ID
 * @param slug - The slug (e.g., "luna-guide-9f3b12a4")
 * @returns The short ID (last segment after hyphen)
 */
export function parseSlugId(slug: string): string | null {
  if (!slug) return null;
  
  // The ID is the last segment after splitting by hyphens
  const parts = slug.split('-');
  if (parts.length === 0) return null;
  
  const lastPart = parts[parts.length - 1];
  
  // Validate it looks like an ID (alphanumeric, 8+ chars)
  if (lastPart && /^[a-z0-9]{8,}$/i.test(lastPart)) {
    return lastPart;
  }
  
  return null;
}

/**
 * Check if a full ID starts with a short ID
 * @param fullId - Full ID from backend
 * @param shortId - Short ID from slug
 * @returns true if fullId starts with shortId
 */
export function matchesShortId(fullId: string | number, shortId: string): boolean {
  const full = String(fullId || '');
  return full.toLowerCase().startsWith(shortId.toLowerCase());
}
