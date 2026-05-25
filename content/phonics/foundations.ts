export type PhonicsVowel = {
  symbol: string;
  zh: string;
  audioSlug: string;
};

export type PhonicsExample = {
  text: string;
  zh: string;
  audioSlug: string;
};

export type PhonicsDiphthong = {
  text: string;
  zh: string;
  audioSlug: string;
  before: string;
  highlight: string;
  after: string;
};

export type PhonicsAudioWord = {
  slug: string;
  text: string;
};

export const PHONICS_VOWELS: PhonicsVowel[] = [
  { symbol: "a", zh: "阿", audioSlug: "a" },
  { symbol: "e", zh: "诶", audioSlug: "e" },
  { symbol: "i", zh: "衣", audioSlug: "i" },
  { symbol: "o", zh: "哦", audioSlug: "o" },
  { symbol: "u", zh: "乌", audioSlug: "u" }
];

export const PHONICS_STRONG_VOWELS: PhonicsExample[] = [
  { text: "casa", zh: "房子", audioSlug: "c" },
  { text: "mesa", zh: "桌子", audioSlug: "m" }
];

export const PHONICS_WEAK_VOWELS: PhonicsExample[] = [
  { text: "isla", zh: "岛", audioSlug: "i" },
  { text: "uno", zh: "一", audioSlug: "u" }
];

export const PHONICS_DIPHTHONGS: PhonicsDiphthong[] = [
  {
    text: "bueno",
    zh: "好的",
    audioSlug: "bueno",
    before: "",
    highlight: "bue",
    after: "no"
  },
  {
    text: "ciudad",
    zh: "城市",
    audioSlug: "ciudad",
    before: "",
    highlight: "ciu",
    after: "dad"
  },
  {
    text: "aire",
    zh: "空气",
    audioSlug: "aire",
    before: "",
    highlight: "ai",
    after: "re"
  }
];

export const PHONICS_FOUNDATION_AUDIO_WORDS: PhonicsAudioWord[] = [
  { slug: "bueno", text: "bueno" },
  { slug: "ciudad", text: "ciudad" },
  { slug: "aire", text: "aire" }
];
