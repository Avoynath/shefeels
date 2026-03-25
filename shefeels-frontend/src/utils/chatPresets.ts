// Preset messages designed to encourage user engagement and platform usage
// These messages are shown when users first select a character to help break the ice

export type PresetMessage = {
  id: string;
  text: string;
  category: 'flirty' | 'casual' | 'spicy' | 'playful' | 'romantic';
};

// Pool of 30 engaging preset messages
const PRESET_MESSAGES: PresetMessage[] = [
  // Flirty (6)
  { id: 'f1', text: "Hey gorgeous, what are you up to? 😏", category: 'flirty' },
  { id: 'f2', text: "I can't stop thinking about you... tell me more about yourself 💋", category: 'flirty' },
  { id: 'f3', text: "You look absolutely stunning today. What's your secret? 😍", category: 'flirty' },
  { id: 'f4', text: "I love your vibe... are you always this captivating? ✨", category: 'flirty' },
  { id: 'f5', text: "Tell me something that would make me blush 😊", category: 'flirty' },
  { id: 'f6', text: "What's something you're really passionate about? 🔥", category: 'flirty' },
  
  // Casual (5)
  { id: 'c1', text: "Hey! How's your day going? 👋", category: 'casual' },
  { id: 'c2', text: "What's the best thing that happened to you today? ☀️", category: 'casual' },
  { id: 'c3', text: "Tell me about your perfect day off 🌟", category: 'casual' },
  { id: 'c4', text: "What do you like to do for fun? 🎉", category: 'casual' },
  { id: 'c5', text: "If you could travel anywhere right now, where would you go? ✈️", category: 'casual' },
  
  // Spicy (7)
  { id: 's1', text: "What's your idea of the perfect date night? 🌙", category: 'spicy' },
  { id: 's2', text: "Tell me your deepest desire... I won't judge 😈", category: 'spicy' },
  { id: 's3', text: "What turns you on the most? 🔥", category: 'spicy' },
  { id: 's4', text: "I love a confident person... show me what you've got 💪", category: 'spicy' },
  { id: 's5', text: "What's the most adventurous thing you've ever done? 🌶️", category: 'spicy' },
  { id: 's6', text: "Do you believe in love at first sight, or should I message you again? 😘", category: 'spicy' },
  { id: 's7', text: "What would you do if we were alone right now? 🔥", category: 'spicy' },
  
  // Playful (6)
  { id: 'p1', text: "If you were a superhero, what would your power be? 🦸", category: 'playful' },
  { id: 'p2', text: "Quick! Tell me your go-to karaoke song 🎤", category: 'playful' },
  { id: 'p3', text: "What's your guilty pleasure that you'd never admit to anyone? 🤫", category: 'playful' },
  { id: 'p4', text: "Would you rather have breakfast for dinner or dinner for breakfast? 🍳", category: 'playful' },
  { id: 'p5', text: "If we were playing truth or dare, which would you pick? 😜", category: 'playful' },
  { id: 'p6', text: "What emoji best describes your personality? Drop it! 🎭", category: 'playful' },
  
  // Romantic (6)
  { id: 'r1', text: "What does romance mean to you? 💕", category: 'romantic' },
  { id: 'r2', text: "Tell me about the most romantic moment you've ever experienced 🌹", category: 'romantic' },
  { id: 'r3', text: "What makes you feel special and appreciated? 💝", category: 'romantic' },
  { id: 'r4', text: "If you could describe your ideal relationship in three words, what would they be? 💖", category: 'romantic' },
  { id: 'r5', text: "What's your love language? I want to know what makes your heart smile 💗", category: 'romantic' },
  { id: 'r6', text: "I'm curious... what qualities do you value most in someone? ❤️", category: 'romantic' },
];

/**
 * Get a random selection of preset messages for a character
 * @param count Number of messages to return (default: 4)
 * @param characterId Optional character ID to ensure variety per character
 * @returns Array of preset messages
 */
export function getRandomPresets(count: number = 4, characterId?: string | number): PresetMessage[] {
  // Use character ID as seed for consistent but varied results per character
  const seed = characterId ? hashCode(String(characterId)) : Math.random() * 1000;
  
  // Shuffle the array using seeded randomization
  const shuffled = [...PRESET_MESSAGES].sort(() => {
    const random = seededRandom(seed + Math.random());
    return random - 0.5;
  });
  
  // Return the requested number of messages, ensuring variety in categories
  const selected: PresetMessage[] = [];
  const usedCategories = new Set<string>();
  
  for (const msg of shuffled) {
    if (selected.length >= count) break;
    
    // Prefer different categories for variety
    if (selected.length < 2 || !usedCategories.has(msg.category)) {
      selected.push(msg);
      usedCategories.add(msg.category);
    }
  }
  
  // If we still need more messages and ran out of unique categories, add any remaining
  for (const msg of shuffled) {
    if (selected.length >= count) break;
    if (!selected.includes(msg)) {
      selected.push(msg);
    }
  }
  
  return selected.slice(0, count);
}

/**
 * Simple hash function to convert string to number (for seeding)
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Get preset messages grouped by category
 */
export function getPresetsByCategory(): Record<string, PresetMessage[]> {
  return PRESET_MESSAGES.reduce((acc, msg) => {
    if (!acc[msg.category]) acc[msg.category] = [];
    acc[msg.category].push(msg);
    return acc;
  }, {} as Record<string, PresetMessage[]>);
}

/**
 * Get all available preset messages
 */
export function getAllPresets(): PresetMessage[] {
  return [...PRESET_MESSAGES];
}
