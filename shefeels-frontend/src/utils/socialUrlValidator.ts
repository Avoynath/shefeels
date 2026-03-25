type Social = "instagram" | "tiktok" | "fanvue" | "onlyfans";

type Validation = {
  valid: boolean;
  username?: string;
  normalized?: string;
  reason?: string;
};

const HOSTS: Record<Social, Set<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]),
  tiktok:    new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]),
  fanvue:    new Set(["fanvue.com", "www.fanvue.com"]),
  onlyfans:  new Set(["onlyfans.com", "www.onlyfans.com"]),
};

const PATH_RE: Record<Social, RegExp> = {
  instagram: /^\/([A-Za-z0-9._]{1,30})\/?$/,
  tiktok: /^\/@([A-Za-z0-9._]{2,24})\/?$/,
  fanvue: /^\/([A-Za-z0-9._]{3,30})\/?$/,
  onlyfans: /^\/([A-Za-z0-9._]{3,30})\/?$/,
};

const IG_RESERVED = new Set([
  "p", "reel", "reels", "stories", "explore", "about", "directory",
  "accounts", "challenge", "privacy", "legal", "api", "help"
]);

export function isValidSocialUrl(input: string, social: Social): Validation {
  let u: URL;
  try {
    u = new URL(input.match(/^https?:\/\//i) ? input : `https://${input}`);
  } catch {
    return { valid: false, reason: "Not a valid URL." };
  }

  if (!/^https?:$/i.test(u.protocol)) {
    return { valid: false, reason: "Only http/https URLs are allowed." };
  }

  const host = u.hostname.toLowerCase();
  if (!HOSTS[social].has(host)) {
    return { valid: false, reason: `Host ${host} is not a ${social} domain.` };
  }

  const m = PATH_RE[social].exec(u.pathname);
  if (!m) {
    return { valid: false, reason: "Path does not look like a profile URL." };
  }

  const username = m[1];

  if (social === "instagram" && IG_RESERVED.has(username.toLowerCase())) {
    return { valid: false, reason: "This is an Instagram route, not a profile." };
  }

  const normalized = (() => {
    switch (social) {
      case "instagram": return `https://instagram.com/${username}`;
      case "tiktok":    return `https://tiktok.com/@${username}`;
      case "fanvue":    return `https://fanvue.com/${username}`;
      case "onlyfans":  return `https://onlyfans.com/${username}`;
    }
  })();

  return { valid: true, username, normalized };
}

export type { Social, Validation };
