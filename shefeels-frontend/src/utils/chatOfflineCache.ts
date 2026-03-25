// Tiny offline cache for chats using IndexedDB + localStorage
// Minimal, dependency-free implementation as requested.

export type CachedMessage = {
  id: string;
  from: "ai" | "me";
  type: "text" | "audio" | "image" | "voice";
  text?: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  inputAudioUrl?: string | null;
  time?: string | number;
  [key: string]: any;
};

const DB_NAME = "hl_chat_cache_v1";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "chat_snapshots";

function openDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB not available"));
  }

  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onerror = () => reject(req.error || new Error("indexedDB open error"));

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "characterId" });
      }
    };

    req.onsuccess = () => {
      resolve(req.result);
    };
  });
}

type ChatSnapshot = {
  characterId: string;
  messages: CachedMessage[];
  updatedAt: number;
};

export async function saveMessagesSnapshot(
  characterId: string | number,
  messages: CachedMessage[],
  maxMessages: number = 200
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
    const store = tx.objectStore(SNAPSHOT_STORE);

    const trimmed = messages.slice(-maxMessages);

    const item: ChatSnapshot = {
      characterId: String(characterId),
      messages: trimmed,
      updatedAt: Date.now(),
    };

    store.put(item);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("tx error"));
      tx.onabort = () => reject(tx.error || new Error("tx aborted"));
    });
  } catch (e) {
    // Swallow errors to avoid breaking UI when IndexedDB is unavailable
    // Log for debugging
    // eslint-disable-next-line no-console
    console.warn("[chatOfflineCache] saveMessagesSnapshot failed", e);
  }
}

export async function loadMessagesSnapshot(
  characterId: string | number
): Promise<CachedMessage[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(SNAPSHOT_STORE, "readonly");
    const store = tx.objectStore(SNAPSHOT_STORE);

    const req = store.get(String(characterId));

    const result = await new Promise<ChatSnapshot | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result as ChatSnapshot | undefined);
      req.onerror = () => reject(req.error || new Error("get error"));
    });

    if (!result) return null;
    return result.messages || null;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[chatOfflineCache] loadMessagesSnapshot failed", e);
    return null;
  }
}

const LAST_MAP_KEY = "hl_lastMap_v1";
const LAST_CHAT_KEY = "hl_lastOpenedChatId_v1";

export function saveLastMapToLocalStorage(lastMap: Record<string, { text: string; time: string }>) {
  try {
    const payload = JSON.stringify(lastMap);
    window.localStorage.setItem(LAST_MAP_KEY, payload);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[chatOfflineCache] saveLastMap failed", e);
  }
}

export function loadLastMapFromLocalStorage(): Record<string, { text: string; time: string }> | null {
  try {
    const raw = window.localStorage.getItem(LAST_MAP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[chatOfflineCache] loadLastMap failed", e);
    return null;
  }
}

export function saveLastOpenedChatId(id: string | number | null) {
  try {
    if (id == null) {
      window.localStorage.removeItem(LAST_CHAT_KEY);
    } else {
      window.localStorage.setItem(LAST_CHAT_KEY, String(id));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[chatOfflineCache] saveLastOpenedChatId failed", e);
  }
}

export function loadLastOpenedChatId(): string | null {
  try {
    return window.localStorage.getItem(LAST_CHAT_KEY);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[chatOfflineCache] loadLastOpenedChatId failed", e);
    return null;
  }
}
