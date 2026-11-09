/** Art styles the user can pick. `prompt` is appended to every generation request. */
export const STYLES = [
  {
    id: "cartoon",
    label: "Cartoon",
    prompt: "bold clean cartoon sticker art, thick dark outlines, flat vibrant colors, simple cel shading",
  },
  {
    id: "3d",
    label: "3D",
    prompt: "glossy 3D render like a modern animated film character, soft studio lighting, smooth materials",
  },
  {
    id: "anime",
    label: "Anime",
    prompt: "chibi anime sticker style, big expressive eyes, clean lineart, pastel colors",
  },
  {
    id: "pixel",
    label: "Pixel",
    prompt: "crisp 32-bit pixel art sprite, limited palette, no anti-aliasing",
  },
  {
    id: "clay",
    label: "Clay",
    prompt: "handmade claymation figure, visible clay texture, soft rounded shapes",
  },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];

/**
 * Expressions/actions a sticker can show. Each becomes one sticker in the pack.
 * `motion` describes the movement for animated stickers; `pose` is the key pose
 * WhatsApp shows when the loop ends (first frame must say it all).
 */
export const ACTIONS = [
  { id: "wave", label: "Hi!", emojis: ["👋", "😊"], pose: "smiling and raising one hand to wave", motion: "waving the raised hand side to side" },
  { id: "laugh", label: "LOL", emojis: ["😂", "🤣"], pose: "laughing hard with eyes squeezed shut", motion: "shaking with laughter, tears of joy flying" },
  { id: "love", label: "Love you", emojis: ["😍", "❤️"], pose: "heart eyes, hugging a big red heart", motion: "the heart pulsing bigger and smaller" },
  { id: "thumbs_up", label: "OK!", emojis: ["👍", "👌"], pose: "confident grin giving a thumbs up", motion: "pumping the thumbs up forward" },
  { id: "cry", label: "Sad", emojis: ["😭", "😢"], pose: "crying with big tears", motion: "sobbing, tears streaming down" },
  { id: "angry", label: "Grr", emojis: ["😡", "😤"], pose: "furious with a red face and clenched fists", motion: "stomping with steam puffing from the ears" },
  { id: "shock", label: "OMG", emojis: ["😱", "😮"], pose: "shocked with mouth wide open, hands on cheeks", motion: "jolting back in surprise" },
  { id: "sleepy", label: "Zzz", emojis: ["😴", "💤"], pose: "sleepy with drooping eyes", motion: "nodding off with Zzz letters floating up" },
  { id: "party", label: "Yay!", emojis: ["🎉", "🥳"], pose: "celebrating with a party hat and confetti", motion: "jumping up and down as confetti falls" },
  { id: "think", label: "Hmm", emojis: ["🤔"], pose: "thinking with a hand on the chin", motion: "tapping the chin, a question mark bobbing" },
  { id: "cool", label: "Cool", emojis: ["😎"], pose: "wearing sunglasses with a smug smile", motion: "sliding the sunglasses down and up" },
  { id: "facepalm", label: "Ugh", emojis: ["🤦", "😩"], pose: "facepalming with one hand", motion: "shaking the head behind the palm" },
] as const;

export type ActionId = (typeof ACTIONS)[number]["id"];

export function findAction(id: string) {
  return ACTIONS.find((a) => a.id === id);
}

export function findStyle(id: string) {
  return STYLES.find((s) => s.id === id);
}

/** Default set offered on the create screen. */
export const DEFAULT_ACTIONS: ActionId[] = ["wave", "laugh", "love", "thumbs_up", "cry", "shock"];
