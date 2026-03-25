/**
 * Custom hooks for character management
 * Provides reusable character-related functionality with loading states and error handling
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient, getErrorMessage, isAuthError } from '../utils/api';
import { normalizeCharacters } from '../utils/normalizeCharacter';
import type { CharacterRead, CharacterCreate } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export interface UseCharactersResult {
  characters: CharacterRead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCharacter: (data: CharacterCreate) => Promise<CharacterRead | null>;
  editCharacter: (id: number, data: CharacterCreate) => Promise<boolean>;
}

/**
 * Hook for managing user's characters
 */
export function useCharacters(): UseCharactersResult {
  const { isAuthenticated, logout } = useAuth();
  const [characters, setCharacters] = useState<CharacterRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
  const data = await apiClient.getUserCharacters();
  setCharacters(Array.isArray(data) ? normalizeCharacters(data) : []);
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  const createCharacter = useCallback(async (data: CharacterCreate): Promise<CharacterRead | null> => {
    if (!isAuthenticated) return null;
    
    try {
      await apiClient.createCharacter(data);
      // Refresh the list to get the new character
      await refresh();
      return characters[characters.length - 1] || null; // Return the newly created character
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
      return null;
    }
  }, [isAuthenticated, logout, refresh, characters]);

  const editCharacter = useCallback(async (id: number, data: CharacterCreate): Promise<boolean> => {
    if (!isAuthenticated) return false;
    
    try {
      await apiClient.editCharacter(id, data);
      // Refresh the list to get updated data
      await refresh();
      return true;
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
      return false;
    }
  }, [isAuthenticated, logout, refresh]);

  // Load characters on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    }
  }, [isAuthenticated, refresh]);

  return {
    characters,
    loading,
    error,
    refresh,
    createCharacter,
    editCharacter,
  };
}

export interface UseDefaultCharactersResult {
  characters: CharacterRead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for getting default/public characters (no auth required)
 */
export function useDefaultCharacters(): UseDefaultCharactersResult {
  const [characters, setCharacters] = useState<CharacterRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.getDefaultCharacters();
      setCharacters(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load default characters on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    characters,
    loading,
    error,
    refresh,
  };
}

export interface UseCharacterMediaResult {
  images: any[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createImages: (data: any) => Promise<string[] | null>;
}

/**
 * Hook for managing character media/images
 */
export function useCharacterMedia(): UseCharacterMediaResult {
  const { isAuthenticated, logout } = useAuth();
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getUserCharacterMedia();
  const responseAny = response as any;
      const rawItems = responseAny?.media || responseAny?.images || responseAny?.data || [];
      // Filter to only include user-created images (exclude chat_image which are images embedded in chat logs)
      const onlyImages = (rawItems || []).filter((it: any) => {
        // If backend provides explicit media_type, prefer that (must equal 'image')
        if (it && typeof it.media_type === 'string') {
          return String(it.media_type).toLowerCase() === 'image';
        }
        // Fallback: use mime_type/content_type when media_type is not present
        const mt = (it && (it.mime_type || it.content_type || '') || '').toString();
        if (mt.toLowerCase().startsWith('image')) return true;
        // Lastly, attempt to infer from common image file extensions in any URL fields
        const url = it && (it.s3_path_gallery || it.s3_path || it.image_s3_url || it.image_url_s3 || it.image_url || it.url || it.path || it.image || it.file || it.img);
        if (typeof url === 'string' && /\.(png|jpe?g|webp|gif|svg)(?:$|\?)/i.test(url)) return true;
        return false;
      });

      const normalized = (onlyImages || []).map((it: any, idx: number) => {
        const char = it.character || it.character_data || null;
        const candidateFromCharacter = char ? (char.image_url_s3 || char.image_url || char.img || null) : null;
        const url = it.s3_path_gallery || it.s3_path || it.image_s3_url || it.image_url_s3 || it.image_url || it.url || it.path || it.image || it.signed_url || it.signedUrl || candidateFromCharacter || (it.attributes && (it.attributes.s3_path_gallery || it.attributes.url || it.attributes.path || it.attributes.image_s3_url || it.attributes.image_url_s3));
        return {
          id: it.id ?? it._id ?? `item-${idx}`,
          mime_type: it.mime_type || it.content_type || (it.type || '').toString(),
          s3_path_gallery: url || null,
          image_s3_url: it.image_s3_url || (char && (char.image_url_s3 || char.image_url)) || null,
          image_url_s3: it.image_url_s3 || (char && (char.image_url_s3 || char.image_url)) || null,
          character: char,
          ...it,
        };
      });
      setImages(normalized || []);
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  const createImages = useCallback(async (data: any): Promise<string[] | null> => {
    if (!isAuthenticated) return null;
    
    try {
      const response = await apiClient.createCharacterImage(data);
      // Refresh the list to include new images
      await refresh();
      return response.image_paths;
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
      return null;
    }
  }, [isAuthenticated, logout, refresh]);

  // Load images on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    }
  }, [isAuthenticated, refresh]);

  return {
    images,
    loading,
    error,
    refresh,
    createImages,
  };
}
