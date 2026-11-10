/**
 * Art styles the user can pick. `prompt` is appended to every generation request.
 * `group: "real"` styles keep a person's real likeness and proportions (no cute cartoon
 * character) and frame them from the waist up, so faces stay big at sticker size.
 */
export const STYLES = [
  {
    id: "cartoon",
    label: "Cartoon",
    group: "drawn",
    prompt: "bold clean cartoon sticker art, thick dark outlines, flat vibrant colors, simple cel shading",
  },
  {
    id: "3d",
    label: "3D",
    group: "drawn",
    prompt: "glossy 3D render like a modern animated film character, soft studio lighting, smooth materials",
  },
  {
    id: "anime",
    label: "Anime",
    group: "drawn",
    prompt: "chibi anime sticker style, big expressive eyes, clean lineart, pastel colors",
  },
  {
    id: "pixel",
    label: "Pixel",
    group: "drawn",
    prompt: "crisp 32-bit pixel art sprite, limited palette, no anti-aliasing",
  },
  {
    id: "doodle",
    label: "Doodle",
    group: "drawn",
    prompt: "hand-drawn marker doodle, wobbly thick black ink lines, flat bright marker fills that don't quite stay in the lines, playful and messy like a notebook sketch",
  },
  {
    id: "watercolor",
    label: "Watercolor",
    group: "drawn",
    prompt: "soft watercolor illustration, loose wet-on-wet paint blooms, visible paper grain, delicate fine ink outline so the shape still reads at small size, warm pastel palette",
  },
  {
    id: "comic",
    label: "Pop comic",
    group: "drawn",
    prompt:
      "vintage 1960s pop-art comic print of a cute character with chibi proportions (big head, small body): a big, clearly visible halftone dot pattern (Ben-Day dots) on the skin and clothes, thick black ink outlines, flat primary red, yellow and blue, slightly off-register printed-paper look",
  },
  {
    id: "sketch",
    label: "Sketch",
    group: "drawn",
    prompt:
      "graphite pencil sketch: confident expressive pencil linework with cross-hatched shading, monochrome graphite grey only, no color",
  },
  {
    id: "emoji",
    label: "Emoji",
    group: "drawn",
    prompt:
      "chat-app emoji icon: one oversized, perfectly round, glossy head with a tiny round body and stubby little hands, extremely simple features (two oval dot eyes, a simple curved mouth, rosy cheeks), smooth plastic shading, the subject's hair and signature details simplified into a few bold shapes",
  },
  {
    id: "clay",
    label: "Clay",
    group: "craft",
    prompt: "handmade claymation figure, visible clay texture, soft rounded shapes",
  },
  {
    id: "plush",
    label: "Plush toy",
    group: "craft",
    prompt: "soft plush stuffed toy, fuzzy felt and fleece fabric with visible stitched seams, embroidered eyes, squishy rounded shapes, cozy toy-shop photo look",
  },
  {
    id: "toy",
    label: "Toy figure",
    group: "craft",
    prompt: "collectible vinyl designer toy figure, smooth matte plastic, simplified chunky shapes, big head, studio product-shot lighting with a soft highlight",
  },
  {
    id: "papercut",
    label: "Paper cut",
    group: "craft",
    prompt:
      "flat layered paper-cut illustration, clearly made of paper and not a 3D render: every shape (face, hair, clothes) is a separate flat cut-out of matte colored card with crisp scissor edges and a thin white paper border, stacked in visible layers with small soft shadows between them, no glossy highlights, no smooth shading",
  },
  {
    id: "photo",
    label: "Real photo",
    group: "real",
    prompt:
      "photorealistic photo of a real person, natural skin texture and real hair detail, soft flattering studio light, sharp focus, true-to-life colors, like a high-quality cut-out photo sticker",
  },
  {
    id: "caricature",
    label: "Caricature",
    group: "real",
    prompt:
      "professional caricature artist's digital painting: a giant head, twice the normal size, on a small narrow body, boldly exaggerated but flattering features (oversized smile, big eyes), lifelike painted skin and hair",
  },
  {
    id: "painted",
    label: "Painted",
    group: "real",
    prompt:
      "hand-painted oil portrait on canvas, clearly a painting and not a photograph: bold, large brushstrokes that stay visible even at small size on the skin, hair and clothes, painterly edges, rich warm colors, lifelike likeness and proportions",
  },
  {
    id: "retro",
    label: "Retro flash",
    group: "real",
    prompt:
      "photorealistic 1990s point-and-shoot film snapshot, hard direct flash on the face, slight film grain, warm faded colors, candid party-photo vibe",
  },
] as const;

export type StyleGroup = (typeof STYLES)[number]["group"];

/** Section titles for the style picker, in display order. */
export const STYLE_GROUPS: { id: StyleGroup; label: string }[] = [
  { id: "drawn", label: "Illustrated" },
  { id: "craft", label: "Toys & crafts" },
  { id: "real", label: "Realistic" },
];

export type StyleId = (typeof STYLES)[number]["id"];

/**
 * Expressions/actions a sticker can show. Each becomes one sticker in the pack.
 * `motion` describes the movement for animated stickers; `pose` is the key pose
 * WhatsApp shows when the loop ends (first frame must say it all).
 */
export const ACTIONS = [
  { id: "wave", category: "chat", label: "Hi!", emojis: ["👋", "😊"], pose: "smiling and raising one hand to wave", motion: "waving the same raised hand side to side, the other arm still" },
  { id: "laugh", category: "react", label: "LOL", emojis: ["😂", "🤣"], pose: "laughing hard with eyes squeezed shut", motion: "shaking with laughter, tears of joy flying" },
  { id: "love", category: "love", label: "Love you", emojis: ["😍", "❤️"], pose: "heart eyes, hugging a big red heart", motion: "the heart pulsing bigger and smaller" },
  { id: "thumbs_up", category: "react", label: "OK!", emojis: ["👍", "👌"], pose: "confident grin giving a thumbs up", motion: "pumping the thumbs up forward" },
  { id: "cry", category: "react", label: "Sad", emojis: ["😭", "😢"], pose: "crying with big tears", motion: "sobbing, tears streaming down" },
  { id: "angry", category: "react", label: "Grr", emojis: ["😡", "😤"], pose: "furious with a red face and clenched fists", motion: "stomping with steam puffing from the ears" },
  { id: "shock", category: "react", label: "OMG", emojis: ["😱", "😮"], pose: "shocked with mouth wide open, hands on cheeks", motion: "jolting back in surprise" },
  { id: "sleepy", category: "chat", label: "Zzz", emojis: ["😴", "💤"], pose: "sleepy with drooping eyes", motion: "nodding off with Zzz letters floating up" },
  { id: "party", category: "occasion", label: "Yay!", emojis: ["🎉", "🥳"], pose: "celebrating with a party hat and confetti", motion: "jumping up and down as confetti falls" },
  { id: "think", category: "react", label: "Hmm", emojis: ["🤔"], pose: "thinking with a hand on the chin", motion: "tapping the chin, a question mark bobbing" },
  { id: "cool", category: "react", label: "Cool", emojis: ["😎"], pose: "wearing sunglasses with a smug smile", motion: "sliding the sunglasses down and up" },
  { id: "facepalm", category: "react", label: "Ugh", emojis: ["🤦", "😩"], pose: "facepalming with one hand", motion: "shaking the head behind the palm" },
  { id: "yes", category: "react", label: "Yes!", emojis: ["✅", "🙌"], pose: "nodding with a big enthusiastic grin, both fists up", motion: "nodding hard, fists pumping" },
  { id: "no", category: "react", label: "Nope", emojis: ["🙅", "❌"], pose: "crossing both arms in a big X in front of the chest, firm frown", motion: "shaking the head side to side, arms still crossed" },
  { id: "shrug", category: "react", label: "Idk", emojis: ["🤷"], pose: "shrugging with both palms up and a puzzled half-smile", motion: "shoulders bouncing up and down in a shrug" },
  { id: "eye_roll", category: "react", label: "Whatever", emojis: ["🙄"], pose: "rolling the eyes upward with an unimpressed flat mouth, arms folded", motion: "eyes rolling around, head tilting back" },
  { id: "morning", category: "chat", label: "Morning!", emojis: ["☀️", "☕"], pose: "stretching happily while holding a steaming coffee mug", motion: "stretching arms up, steam curling from the mug" },
  { id: "night", category: "chat", label: "Night!", emojis: ["🌙", "😴"], pose: "in a nightcap hugging a pillow, eyes half closed, a crescent moon nearby", motion: "swaying sleepily, a small moon bobbing" },
  { id: "thanks", category: "chat", label: "Thanks!", emojis: ["🙏", "🥰"], pose: "bowing slightly with both hands pressed together, grateful smile", motion: "bowing again and again, small sparkles popping" },
  { id: "sorry", category: "chat", label: "Sorry", emojis: ["🥺", "🙏"], pose: "puppy-dog eyes, hands clasped, guilty pleading look", motion: "pleading with hands rubbing together, eyes wobbling" },
  { id: "omw", category: "chat", label: "On my way", emojis: ["🏃", "💨"], pose: "running fast, mid-stride, with speed lines and a dust cloud", motion: "legs running in a blur, dust puffs trailing" },
  { id: "busy", category: "chat", label: "Busy", emojis: ["💻", "😵"], pose: "typing frantically on a laptop with a stressed sweaty face", motion: "fingers hammering the keyboard, papers flying" },
  { id: "hungry", category: "chat", label: "Hungry", emojis: ["🍕", "🤤"], pose: "drooling with a fork and knife in hand, a slice of pizza floating nearby", motion: "licking lips and bouncing in the seat, fork tapping" },
  { id: "please", category: "chat", label: "Pleeease", emojis: ["🥺"], pose: "huge watery begging eyes, hands together under the chin", motion: "eyes sparkling and trembling, leaning closer" },
  { id: "bye", category: "chat", label: "Bye!", emojis: ["👋", "😘"], pose: "waving goodbye with a cheeky smile, half turned to leave", motion: "waving goodbye over the shoulder" },
  { id: "miss_you", category: "love", label: "Miss you", emojis: ["🥺", "💌"], pose: "hugging a love letter to the chest with a wistful smile", motion: "swaying gently, a small heart floating up" },
  { id: "hug", category: "love", label: "Hugs", emojis: ["🤗"], pose: "arms wide open for a big warm hug, eyes closed in a smile", motion: "squeezing into a hug and rocking side to side" },
  { id: "kiss", category: "love", label: "Mwah", emojis: ["😘", "💋"], pose: "blowing a kiss with a little heart flying from the hand", motion: "kissing the hand and sending the heart flying" },
  { id: "dance", category: "occasion", label: "Woohoo!", emojis: ["💃", "🕺"], pose: "dancing with one arm up, hips to the side, big grin", motion: "dancing side to side to the beat, arms swinging" },
  { id: "birthday", category: "occasion", label: "HBD!", emojis: ["🎂", "🎈"], pose: "holding a birthday cake with lit candles, party hat on", motion: "blowing out the candles, balloons bobbing" },
  { id: "congrats", category: "occasion", label: "Congrats!", emojis: ["🏆", "👏"], pose: "clapping excitedly with a gold trophy beside them", motion: "clapping fast, sparkles bursting" },
  { id: "cheers", category: "occasion", label: "Cheers!", emojis: ["🥂", "🍻"], pose: "raising a glass for a toast with a cheeky grin", motion: "clinking the glass forward, bubbles rising" },
  { id: "xmas", category: "occasion", label: "Merry Xmas", emojis: ["🎄", "🎅"], pose: "wearing a red Santa hat and holding a red wrapped gift with a gold bow, standing on nothing (no tree, no grass, no snowy ground)", motion: "shaking the gift excitedly, snowflakes falling" },
  { id: "boo", category: "occasion", label: "Boo!", emojis: ["👻", "🎃"], pose: "popping out with a spooky grin, holding a carved pumpkin", motion: "jumping forward to scare, the pumpkin glowing" },
] as const;

export type ActionId = (typeof ACTIONS)[number]["id"];
export type ActionCategory = (typeof ACTIONS)[number]["category"];

/** Headings that split the reaction picker, in display order. */
export const ACTION_CATEGORIES: { id: ActionCategory; label: string }[] = [
  { id: "react", label: "Reactions" },
  { id: "chat", label: "Everyday" },
  { id: "love", label: "Love" },
  { id: "occasion", label: "Party & holidays" },
];

/**
 * Ready-made packs: one tap picks a set of reactions that go together, like the themed
 * packs (memes, love, greetings, holidays) other sticker apps lead with.
 */
export const PACK_THEMES: { id: string; label: string; actions: ActionId[] }[] = [
  { id: "everyday", label: "Everyday chat", actions: ["wave", "thumbs_up", "laugh", "thanks", "omw", "night"] },
  { id: "memes", label: "Meme reactions", actions: ["laugh", "shock", "facepalm", "eye_roll", "shrug", "cool"] },
  { id: "love", label: "Love & flirting", actions: ["love", "kiss", "hug", "miss_you", "please", "night"] },
  { id: "greetings", label: "Hello & goodbye", actions: ["morning", "wave", "thanks", "sorry", "bye", "night"] },
  { id: "party", label: "Party time", actions: ["party", "dance", "cheers", "birthday", "congrats", "laugh"] },
  { id: "holidays", label: "Holidays", actions: ["xmas", "cheers", "hug", "party", "boo", "love"] },
];

export function findAction(id: string) {
  return ACTIONS.find((a) => a.id === id);
}

export function findStyle(id: string) {
  return STYLES.find((s) => s.id === id);
}

/** Default set offered on the create screen. */
export const DEFAULT_ACTIONS: ActionId[] = ["wave", "laugh", "love", "thumbs_up", "cry", "shock"];
