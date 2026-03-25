// Centralized chat-related TypeScript types
export type SocialKey = "instagram" | "tiktok" | "onlyfans" | "fanvue";

export type CharacterProfile = {
  name: string;
  age: number;
  bio: string;
  gender?: string;
  gallery: number[];
  details: { label: string; value: string; iconKey: string }[];
  traits: { label: string; value: string; iconKey: string }[];
};

// Status of an async image generation job
export type ImageJobStatus = 'queued' | 'generating' | 'completed' | 'failed';

export type Message = {
  id: string;
  from: "ai" | "me";
  type: "text" | "audio" | "image" | "voice" | "image-pending";
  text?: string;
  imageUrl?: string | null;
  audioUrl?: string | null;
  inputAudioUrl?: string | null;
  duration?: string;
  time?: string;
  // Async image generation support
  imageJobId?: string | null;
  imageJobStatus?: ImageJobStatus | null;
  imageJobError?: string | null;
  // allow arbitrary extra fields from backend
  [k: string]: any;
};

export type ChatItem = {
  id: string;
  name: string;
  hue: number;
  isOnline?: boolean;
  last: string;
  time: string;
  unread?: number;
  ai?: boolean;
  profile?: Partial<CharacterProfile>;
  imageUrl?: string;
};

// Lightweight Character type used within the Chat page for characters fetched from API
export type Character = {
  id: number;
  username?: string;
  name?: string;
  bio?: string;
  age?: number | null;
  image_url_s3?: string | null;
  // allow additional backend fields
  [k: string]: any;
};
