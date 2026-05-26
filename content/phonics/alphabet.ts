export type PronunciationRuleWord = {
  text: string;
  zh: string;
  audioSlug: string;
};

export type PronunciationRule = {
  condition: string;
  sound: string;
  syllables: string[];
  words: PronunciationRuleWord[];
};

export type AlphabetLetter = {
  letter: string;
  letterLower: string;
  name: string;
  example: string;
  exampleZh: string;
  slug: string;
  rules?: PronunciationRule[];
};

const B_V_RULES: PronunciationRule[] = [
  {
    condition: "多数位置都像「波」",
    sound: "[b]，嘴唇先闭合再放开",
    syllables: ["ba", "be", "bi", "bo", "bu"],
    words: [
      { text: "barco", zh: "船", audioSlug: "b" },
      { text: "vino", zh: "葡萄酒", audioSlug: "v" }
    ]
  },
  {
    condition: "和另一个字母不靠发音区分",
    sound: "B 和 V 在现代西语里基本同音，靠拼写记熟",
    syllables: ["va", "ve", "vi", "vo", "vu"],
    words: [
      { text: "uva", zh: "葡萄", audioSlug: "uva" },
      { text: "vivo", zh: "我住", audioSlug: "vivo" }
    ]
  }
];

export const SPANISH_ALPHABET: AlphabetLetter[] = [
  { letter: "A", letterLower: "a", name: "a", example: "amigo", exampleZh: "朋友", slug: "a" },
  {
    letter: "B",
    letterLower: "b",
    name: "be",
    example: "barco",
    exampleZh: "船",
    slug: "b",
    rules: B_V_RULES
  },
  {
    letter: "C",
    letterLower: "c",
    name: "ce",
    example: "casa",
    exampleZh: "房子",
    slug: "c",
    rules: [
      {
        condition: "在 e / i 前",
        sound: "[s]，像轻一点的「丝」",
        syllables: ["ce", "ci"],
        words: [
          { text: "cena", zh: "晚餐", audioSlug: "cena" },
          { text: "cine", zh: "电影院", audioSlug: "cine" }
        ]
      },
      {
        condition: "在 a / o / u 前",
        sound: "[k]，像「卡 / 科 / 库」",
        syllables: ["ca", "co", "cu"],
        words: [
          { text: "casa", zh: "房子", audioSlug: "c" },
          { text: "comer", zh: "吃", audioSlug: "comer" }
        ]
      },
      {
        condition: "组成 ch",
        sound: "固定读「吃」",
        syllables: ["cha", "che", "chi", "cho", "chu"],
        words: [
          { text: "chico", zh: "男孩", audioSlug: "chico" },
          { text: "leche", zh: "牛奶", audioSlug: "leche" }
        ]
      }
    ]
  },
  {
    letter: "D",
    letterLower: "d",
    name: "de",
    example: "día",
    exampleZh: "日子",
    slug: "d",
    rules: [
      {
        condition: "词首更硬",
        sound: "[d]，像清楚一点的「德」",
        syllables: ["da", "de", "di", "do", "du"],
        words: [
          { text: "dos", zh: "二", audioSlug: "dos" },
          { text: "domingo", zh: "星期天", audioSlug: "domingo" }
        ]
      },
      {
        condition: "元音之间会更软",
        sound: "舌尖轻碰牙背，不要太爆破",
        syllables: ["ada", "ede", "ido"],
        words: [
          { text: "nada", zh: "没什么", audioSlug: "nada" },
          { text: "Madrid", zh: "马德里", audioSlug: "madrid" }
        ]
      }
    ]
  },
  { letter: "E", letterLower: "e", name: "e", example: "escuela", exampleZh: "学校", slug: "e" },
  {
    letter: "F",
    letterLower: "f",
    name: "efe",
    example: "familia",
    exampleZh: "家庭",
    slug: "f",
    rules: [
      {
        condition: "所有位置",
        sound: "[f]，和英语 f 相同，上齿轻触下唇",
        syllables: ["fa", "fe", "fi", "fo", "fu"],
        words: [
          { text: "familia", zh: "家庭", audioSlug: "f" },
          { text: "fácil", zh: "容易", audioSlug: "facil" }
        ]
      }
    ]
  },
  {
    letter: "G",
    letterLower: "g",
    name: "ge",
    example: "gato",
    exampleZh: "猫",
    slug: "g",
    rules: [
      {
        condition: "在 e / i 前",
        sound: "像更重一点的「喝」",
        syllables: ["ge", "gi"],
        words: [
          { text: "gesto", zh: "手势", audioSlug: "gesto" },
          { text: "gira", zh: "巡演", audioSlug: "gira" }
        ]
      },
      {
        condition: "在 a / o / u 或 gue / gui 中",
        sound: "[g]，像「哥」",
        syllables: ["ga", "gue", "gui", "go", "gu"],
        words: [
          { text: "gato", zh: "猫", audioSlug: "g" },
          { text: "guía", zh: "向导", audioSlug: "guia" }
        ]
      }
    ]
  },
  {
    letter: "H",
    letterLower: "h",
    name: "hache",
    example: "hola",
    exampleZh: "你好",
    slug: "h",
    rules: [
      {
        condition: "所有位置都不发音",
        sound: "写出来，但嘴里别把它读出来",
        syllables: ["ha", "he", "hi", "ho", "hu"],
        words: [
          { text: "hola", zh: "你好", audioSlug: "h" },
          { text: "hijo", zh: "儿子", audioSlug: "hijo" }
        ]
      }
    ]
  },
  { letter: "I", letterLower: "i", name: "i", example: "isla", exampleZh: "岛", slug: "i" },
  {
    letter: "J",
    letterLower: "j",
    name: "jota",
    example: "jamón",
    exampleZh: "火腿",
    slug: "j",
    rules: [
      {
        condition: "所有位置（注意：和英语 J 完全不同）",
        sound: "[x]，像用力呼出一口气，喉咙收紧，不是「扎」",
        syllables: ["ja", "je", "ji", "jo", "ju"],
        words: [
          { text: "jamón", zh: "火腿", audioSlug: "j" },
          { text: "hijo", zh: "儿子", audioSlug: "hijo" },
          { text: "mujer", zh: "女人", audioSlug: "mujer" }
        ]
      }
    ]
  },
  {
    letter: "K",
    letterLower: "k",
    name: "ka",
    example: "kilo",
    exampleZh: "公斤",
    slug: "k",
    rules: [
      {
        condition: "只出现在外来词和专有名词",
        sound: "[k]，发音和 ca/co/cu 的 c 相同",
        syllables: ["ka", "ke", "ki", "ko"],
        words: [
          { text: "kilo", zh: "公斤", audioSlug: "k" },
          { text: "karate", zh: "空手道", audioSlug: "karate" }
        ]
      }
    ]
  },
  {
    letter: "L",
    letterLower: "l",
    name: "ele",
    example: "libro",
    exampleZh: "书",
    slug: "l",
    rules: [
      {
        condition: "单个 l",
        sound: "[l]，像轻一点的「了」",
        syllables: ["la", "le", "li", "lo", "lu"],
        words: [
          { text: "libro", zh: "书", audioSlug: "l" },
          { text: "luna", zh: "月亮", audioSlug: "luna" }
        ]
      },
      {
        condition: "组成 ll",
        sound: "现代拉美常读成接近「y」的音",
        syllables: ["lla", "lle", "lli", "llo", "llu"],
        words: [
          { text: "ella", zh: "她", audioSlug: "ella" },
          { text: "pollo", zh: "鸡肉", audioSlug: "pollo" }
        ]
      }
    ]
  },
  {
    letter: "M",
    letterLower: "m",
    name: "eme",
    example: "mesa",
    exampleZh: "桌子",
    slug: "m",
    rules: [
      {
        condition: "多数位置",
        sound: "[m]，嘴唇合拢，和中文「妈」开头一样",
        syllables: ["ma", "me", "mi", "mo", "mu"],
        words: [
          { text: "mesa", zh: "桌子", audioSlug: "m" },
          { text: "mano", zh: "手", audioSlug: "mano" }
        ]
      }
    ]
  },
  {
    letter: "N",
    letterLower: "n",
    name: "ene",
    example: "noche",
    exampleZh: "夜晚",
    slug: "n",
    rules: [
      {
        condition: "一般位置",
        sound: "[n]，舌尖贴上颚，和中文「那」开头一样",
        syllables: ["na", "ne", "ni", "no", "nu"],
        words: [
          { text: "noche", zh: "夜晚", audioSlug: "n" },
          { text: "nombre", zh: "名字", audioSlug: "nombre" }
        ]
      },
      {
        condition: "在 b / p 前",
        sound: "[m]，嘴唇自然合拢，如 un poco → 「um poco」",
        syllables: ["nb", "np", "mb", "mp"],
        words: [
          { text: "un poco", zh: "一点", audioSlug: "un-poco" },
          { text: "también", zh: "也", audioSlug: "tambien" }
        ]
      },
      {
        condition: "在 g / k / c(a/o/u) 前",
        sound: "[ŋ]，鼻音从喉咙出，像「英」结尾的 ng",
        syllables: ["ng", "nk", "nc"],
        words: [
          { text: "tengo", zh: "我有", audioSlug: "tengo" },
          { text: "banco", zh: "银行", audioSlug: "banco" }
        ]
      }
    ]
  },
  {
    letter: "Ñ",
    letterLower: "ñ",
    name: "eñe",
    example: "niño",
    exampleZh: "男孩",
    slug: "n-tilde",
    rules: [
      {
        condition: "所有位置（西语独有字母）",
        sound: "[ɲ]，像说「你」的鼻音延长，舌面贴上颚，不是 n+i",
        syllables: ["ña", "ñe", "ñi", "ño", "ñu"],
        words: [
          { text: "niño", zh: "男孩", audioSlug: "n-tilde" },
          { text: "mañana", zh: "明天", audioSlug: "manana" },
          { text: "español", zh: "西班牙语", audioSlug: "espanol" }
        ]
      }
    ]
  },
  { letter: "O", letterLower: "o", name: "o", example: "oso", exampleZh: "熊", slug: "o" },
  {
    letter: "P",
    letterLower: "p",
    name: "pe",
    example: "pan",
    exampleZh: "面包",
    slug: "p",
    rules: [
      {
        condition: "所有位置（无送气）",
        sound: "[p]，嘴唇爆破，但不像英语 p 那样带气流，更干净短促",
        syllables: ["pa", "pe", "pi", "po", "pu"],
        words: [
          { text: "pan", zh: "面包", audioSlug: "p" },
          { text: "pelo", zh: "头发", audioSlug: "pelo" }
        ]
      }
    ]
  },
  {
    letter: "Q",
    letterLower: "q",
    name: "cu",
    example: "queso",
    exampleZh: "奶酪",
    slug: "q",
    rules: [
      {
        condition: "只在 que / qui 里常见",
        sound: "读 [k]，里面的 u 不发音",
        syllables: ["que", "qui"],
        words: [
          { text: "queso", zh: "奶酪", audioSlug: "q" },
          { text: "quiero", zh: "我想要", audioSlug: "quiero" }
        ]
      }
    ]
  },
  {
    letter: "R",
    letterLower: "r",
    name: "erre",
    example: "rosa",
    exampleZh: "玫瑰",
    slug: "r",
    rules: [
      {
        condition: "词首或 l/n/s 后",
        sound: "更明显的滚舌音",
        syllables: ["ra", "re", "ri", "ro", "ru"],
        words: [
          { text: "rosa", zh: "玫瑰", audioSlug: "r" },
          { text: "rueda", zh: "轮子", audioSlug: "rueda" }
        ]
      },
      {
        condition: "写成 rr",
        sound: "连续更强的滚舌",
        syllables: ["rr", "rra", "rre", "rri", "rro", "rru"],
        words: [
          { text: "arroz", zh: "米饭", audioSlug: "arroz" },
          { text: "perro", zh: "狗", audioSlug: "perro" }
        ]
      },
      {
        condition: "词尾通常较轻",
        sound: "轻轻弹一下，不必滚很久",
        syllables: ["ar", "er", "ir", "or", "ur"],
        words: [
          { text: "trabajar", zh: "工作", audioSlug: "trabajar" },
          { text: "comer", zh: "吃", audioSlug: "comer" }
        ]
      }
    ]
  },
  {
    letter: "S",
    letterLower: "s",
    name: "ese",
    example: "sol",
    exampleZh: "太阳",
    slug: "s",
    rules: [
      {
        condition: "拉美西语所有位置",
        sound: "[s]，轻而清晰，和「丝」开头相同",
        syllables: ["sa", "se", "si", "so", "su"],
        words: [
          { text: "sol", zh: "太阳", audioSlug: "s" },
          { text: "casa", zh: "房子", audioSlug: "c" }
        ]
      }
    ]
  },
  {
    letter: "T",
    letterLower: "t",
    name: "te",
    example: "taza",
    exampleZh: "杯子",
    slug: "t",
    rules: [
      {
        condition: "所有位置（齿音，无送气）",
        sound: "[t]，舌尖贴上齿，比英语 t 更靠前，不带气流",
        syllables: ["ta", "te", "ti", "to", "tu"],
        words: [
          { text: "taza", zh: "杯子", audioSlug: "t" },
          { text: "tiempo", zh: "时间 / 天气", audioSlug: "tiempo" }
        ]
      }
    ]
  },
  { letter: "U", letterLower: "u", name: "u", example: "uno", exampleZh: "一", slug: "u" },
  {
    letter: "V",
    letterLower: "v",
    name: "uve",
    example: "vino",
    exampleZh: "葡萄酒",
    slug: "v",
    rules: B_V_RULES
  },
  {
    letter: "W",
    letterLower: "w",
    name: "uve doble",
    example: "web",
    exampleZh: "网站",
    slug: "w",
    rules: [
      {
        condition: "外来词里（源自英语）",
        sound: "[w]，圆唇滑音，像「屋」快速过去",
        syllables: ["wa", "we", "wi"],
        words: [
          { text: "web", zh: "网站", audioSlug: "w" },
          { text: "wifi", zh: "无线网", audioSlug: "wifi" }
        ]
      },
      {
        condition: "外来词里（源自德语、纳瓦特尔语等）",
        sound: "有时读成 [b]，和 B/V 相同",
        syllables: ["wa", "wo"],
        words: [
          { text: "Wágner", zh: "瓦格纳", audioSlug: "w" }
        ]
      }
    ]
  },
  {
    letter: "X",
    letterLower: "x",
    name: "equis",
    example: "xilófono",
    exampleZh: "木琴",
    slug: "x",
    rules: [
      {
        condition: "词首常简化为 [s]",
        sound: "像「西」",
        syllables: ["xi"],
        words: [{ text: "xilófono", zh: "木琴", audioSlug: "x" }]
      },
      {
        condition: "元音中间多读 [ks]",
        sound: "像「克斯」连在一起",
        syllables: ["xa", "xe", "xi", "xo", "xu"],
        words: [{ text: "examen", zh: "考试", audioSlug: "examen" }]
      },
      {
        condition: "墨西哥等词里",
        sound: "常保留更接近 [x] 的老读法",
        syllables: ["xa", "xo"],
        words: [{ text: "México", zh: "墨西哥", audioSlug: "mexico" }]
      }
    ]
  },
  {
    letter: "Y",
    letterLower: "y",
    name: "ye",
    example: "yo",
    exampleZh: "我",
    slug: "y",
    rules: [
      {
        condition: "单独作辅音时",
        sound: "像英文 yes 的 y",
        syllables: ["ya", "ye", "yi", "yo", "yu"],
        words: [
          { text: "yo", zh: "我", audioSlug: "y" },
          { text: "yema", zh: "蛋黄", audioSlug: "yema" }
        ]
      },
      {
        condition: "作连词 y 时",
        sound: "单独读成 [i]，像「衣」",
        syllables: ["y"],
        words: [{ text: "y", zh: "和", audioSlug: "y-conjunction" }]
      }
    ]
  },
  {
    letter: "Z",
    letterLower: "z",
    name: "zeta",
    example: "zapato",
    exampleZh: "鞋",
    slug: "z",
    rules: [
      {
        condition: "在拉美西语里多读 [s]",
        sound: "像「丝」",
        syllables: ["za", "ze", "zi", "zo", "zu"],
        words: [
          { text: "zapato", zh: "鞋", audioSlug: "z" },
          { text: "zona", zh: "区域", audioSlug: "zona" }
        ]
      }
    ]
  }
];
