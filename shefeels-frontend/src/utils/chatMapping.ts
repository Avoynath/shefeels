// Utility to map backend chat items to frontend Message[] shape.
// This keeps mapping logic centralized so multiple components use the same rules.

export type RawChatItem = any;
export type Message = any;

export function defaultSentenceSplitter(text: string): string[] {
  try {
    if (!text) return [];
    const t = String(text).trim();
    if (!t) return [];
    const sentences = t.replace(/\r\n/g, '\n')
      .split(/(?<=[.?!])\s+(?=[A-Z0-9"'`\(\[\-])/g)
      .map(s => s.trim())
      .filter(Boolean);
    if (sentences.length === 0) return [t];
    return sentences;
  } catch (e) {
    return [String(text)];
  }
}

export function mapBackendMessages(rawItems: RawChatItem[], existingIds?: Set<string>, sentenceSplitter: (t: string) => string[] = defaultSentenceSplitter): Message[] {
  const mapped: Message[] = [];
  const ids = existingIds || new Set<string>();

  for (const it of (rawItems || [])) {
    try {
      // Handle voice messages (with or without image)
      if ((it.media_type === 'voice' || it.media_type === 'voice_with_image') && it.s3_url_media) {
        let mediaObj = it.s3_url_media;
        if (typeof mediaObj === 'string') {
          try { mediaObj = JSON.parse(mediaObj); } catch (_) { /* ignore */ }
        }
        const inUrl = mediaObj?.input_url || mediaObj?.inputUrl || null;
        const outUrl = mediaObj?.output_url || mediaObj?.outputUrl || null;
        const imgUrl = mediaObj?.image_url || mediaObj?.imageUrl || mediaObj?.image || null;
        
        // User's voice input
        if (inUrl && !ids.has(`${it.id}-u-voice`)) {
          ids.add(`${it.id}-u-voice`);
          mapped.push({ id: `${it.id}-u-voice`, from: 'me', type: 'voice', audioUrl: String(inUrl), inputAudioUrl: String(inUrl), time: it.created_at });
        }
        // AI's voice output
        if (outUrl && !ids.has(`${it.id}-a-voice`)) {
          ids.add(`${it.id}-a-voice`);
          mapped.push({ id: `${it.id}-a-voice`, from: 'ai', type: 'voice', audioUrl: String(outUrl), time: it.created_at });
        }
        // AI's generated image (for voice_with_image)
        if (imgUrl && !ids.has(`${it.id}-a-img`)) {
          ids.add(`${it.id}-a-img`);
          mapped.push({ id: `${it.id}-a-img`, from: 'ai', type: 'image', imageUrl: String(imgUrl), time: it.created_at });
        }
        continue;
      }
    } catch (e) {
      // fallthrough to text mapping
    }

    if (it.user_query && !ids.has(`${it.id}-u`)) mapped.push({ id: `${it.id}-u`, from: 'me', type: 'text', text: String(it.user_query), time: it.created_at });

    if (it.ai_message) {
      const parts = sentenceSplitter(String(it.ai_message));
      if (parts.length > 0) {
        for (let i = 0; i < parts.length; i++) {
          const mid = `${it.id}-a-${i}`;
          if (!ids.has(mid)) mapped.push({ id: mid, from: 'ai', type: 'text', text: parts[i], time: it.created_at });
        }
      } else {
        const mid = `${it.id}-a`;
        if (!ids.has(mid)) mapped.push({ id: mid, from: 'ai', type: 'text', text: String(it.ai_message), time: it.created_at });
      }
    }

    if (it.is_media_available && it.s3_url_media) {
      let imageUrl: string | null = null;
      try {
        if (typeof it.s3_url_media === 'string') imageUrl = it.s3_url_media;
        else if (it.s3_url_media) imageUrl = it.s3_url_media.input_url || it.s3_url_media.output_url || it.s3_url_media.url || it.s3_url_media.image || null;
      } catch (e) {}
      const mid = `${it.id}-m`;
      if (imageUrl && !ids.has(mid)) mapped.push({ id: mid, from: 'ai', type: 'image', imageUrl: String(imageUrl), time: it.created_at });
    }

    // Handle image violations (blocked content)
    if (it.media_type === 'image_violation' && !ids.has(`${it.id}-v`)) {
      mapped.push({ 
        id: `${it.id}-v`, 
        from: 'ai', 
        type: 'image', 
        imageUrl: '', 
        isViolation: true, 
        time: it.created_at 
      });
    }
  }

  return mapped;
}

// Lightweight cache for mapping results to avoid repeated work when the same
// raw items are processed multiple times. Cache key is based on the sequence
// of item ids + created_at timestamp. This keeps the cache stable across
// rerenders while avoiding deep object equality.
const _mapCache = new Map<string, Message[]>();

// Expose a way to clear cache when needed (e.g., after voice+image updates)
export function clearMapCache() {
  _mapCache.clear();
}

export function mapBackendMessagesCached(rawItems: RawChatItem[], existingIds?: Set<string>, sentenceSplitter: (t: string) => string[] = defaultSentenceSplitter): Message[] {
  try {
    if (!rawItems || rawItems.length === 0) return [];
    // Include media_type in cache key to handle voice_with_image properly
    const idKey = rawItems.map((it: any) => `${String(it && (it.id ?? '') )}@${String(it && (it.created_at ?? ''))}@${String(it && (it.media_type ?? ''))}`).join('|');
    const existKey = existingIds && existingIds.size > 0 ? Array.from(existingIds).sort().join(',') : '';
    const cacheKey = `${idKey}::${existKey}`;
    const cached = _mapCache.get(cacheKey);
    if (cached) return cached;
    const res = mapBackendMessages(rawItems, existingIds, sentenceSplitter);
    try { _mapCache.set(cacheKey, res); } catch (e) {}
    return res;
  } catch (e) {
    return mapBackendMessages(rawItems, existingIds, sentenceSplitter);
  }
}
