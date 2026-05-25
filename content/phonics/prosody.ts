export type PhonicsStressExample = {
  slug: string;
  text: string;
  zh: string;
  syllables: string[];
  stressedIndex: number;
};

export type PhonicsStressRule = {
  title: string;
  description: string;
  examples: PhonicsStressExample[];
};

export type PhonicsSinalefaSentence = {
  slug: string;
  text: string;
  pronunciation: string;
  note: string;
  parts: PhonicsSinalefaParts;
};

export type PhonicsSinalefaParts = {
  before: string;
  merge: string;
  after: string;
};

export const PHONICS_STRESS_RULES: PhonicsStressRule[] = [
  {
    title: "词尾是元音 / N / S",
    description: "通常重读倒数第二个音节。",
    examples: [
      {
        slug: "casa",
        text: "casa",
        zh: "房子",
        syllables: ["ca", "sa"],
        stressedIndex: 0
      },
      {
        slug: "comen",
        text: "comen",
        zh: "他们吃",
        syllables: ["co", "men"],
        stressedIndex: 1
      }
    ]
  },
  {
    title: "词尾是其他辅音",
    description: "通常重读最后一个音节。",
    examples: [
      {
        slug: "ciudad",
        text: "ciudad",
        zh: "城市",
        syllables: ["ciu", "dad"],
        stressedIndex: 1
      },
      {
        slug: "trabajar",
        text: "trabajar",
        zh: "工作",
        syllables: ["tra", "ba", "jar"],
        stressedIndex: 2
      }
    ]
  },
  {
    title: "有重音符号（´）",
    description: "符号落在哪个音节，就重读哪个音节。",
    examples: [
      {
        slug: "cafe",
        text: "café",
        zh: "咖啡",
        syllables: ["ca", "fé"],
        stressedIndex: 1
      },
      {
        slug: "musica",
        text: "música",
        zh: "音乐",
        syllables: ["mú", "si", "ca"],
        stressedIndex: 0
      }
    ]
  }
];

export const PHONICS_SINALEFA_SENTENCES: PhonicsSinalefaSentence[] = [
  {
    slug: "mi-amigo",
    text: "mi amigo",
    pronunciation: "mia·mi·go",
    note: "i + a 合并",
    parts: {
      before: "m",
      merge: "i a",
      after: "migo"
    }
  },
  {
    slug: "la-escuela",
    text: "la escuela",
    pronunciation: "laes·cue·la",
    note: "a + e 合并",
    parts: {
      before: "l",
      merge: "a e",
      after: "scuela"
    }
  },
  {
    slug: "todo-el-dia",
    text: "todo el día",
    pronunciation: "to·doel·dí·a",
    note: "o + e 合并",
    parts: {
      before: "todo ",
      merge: "e",
      after: "l día"
    }
  }
];
