export type GrammarGroup = "动词变位" | "名词性别" | "常见辨析";

export type ConjugationRow = {
  pronoun: string;
  person: string;
  form: string;
  audioLabel?: string;
};

export type GrammarTopic = {
  slug: string;
  group: GrammarGroup;
  title: string;
  intro: string;
  analogy: string;
  conjugations?: ConjugationRow[];
  rules?: string[];
  examples?: Array<{
    spanish: string;
    chinese: string;
    reason: string;
  }>;
  comparison?: {
    ser: Array<{ spanish: string; chinese: string; reason: string }>;
    estar: Array<{ spanish: string; chinese: string; reason: string }>;
  };
  related?: Array<{ label: string; slug: string }>;
};

export const COURSE_002_UPDATED_AT = "2026-05-13 14:20";

const standardPronouns = [
  ["yo", "我，第一人称单数"],
  ["tú", "你，第二人称单数"],
  ["él / ella / usted", "他、她、您，第三人称单数"],
  ["nosotros / nosotras", "我们，第一人称复数"],
  ["vosotros / vosotras", "你们，第二人称复数"],
  ["ellos / ellas / ustedes", "他们、她们、各位，第三人称复数"]
] as const;

const conjugations = (forms: string[]): ConjugationRow[] =>
  standardPronouns.map(([pronoun, person], index) => ({
    pronoun,
    person,
    form: forms[index],
    audioLabel: forms[index]
  }));

export const grammarTopics: GrammarTopic[] = [
  {
    slug: "ser",
    group: "动词变位",
    title: "ser 现在时变位",
    intro: "表达身份、来源、本质特征，相当于在说“是什么”。",
    analogy:
      "中文里“我是学生”“这是咖啡”都不用动词变化；西语里 ser 会跟着主语换形，先把它当成“身份标签”的专用动词。",
    conjugations: conjugations(["soy", "eres", "es", "somos", "sois", "son"]),
    examples: [
      {
        spanish: "Soy estudiante.",
        chinese: "我是学生。",
        reason: "身份，用 ser。"
      },
      {
        spanish: "Ella es de Madrid.",
        chinese: "她来自马德里。",
        reason: "来源，用 ser。"
      }
    ],
    related: [{ label: "查看相关语法 → ser vs estar", slug: "ser-vs-estar" }]
  },
  {
    slug: "estar",
    group: "动词变位",
    title: "estar 现在时变位",
    intro: "表达状态、位置和临时情况，相当于在说“现在处于什么样”。",
    analogy:
      "中文说“我累了”“我在家”都很自然；西语要用 estar 强调此刻状态或所在位置，而不是永久身份。",
    conjugations: conjugations(["estoy", "estás", "está", "estamos", "estáis", "están"]),
    examples: [
      {
        spanish: "Estoy cansado.",
        chinese: "我累了。",
        reason: "当前状态，用 estar。"
      },
      {
        spanish: "Estamos en casa.",
        chinese: "我们在家。",
        reason: "位置，用 estar。"
      }
    ],
    related: [{ label: "查看相关语法 → ser vs estar", slug: "ser-vs-estar" }]
  },
  {
    slug: "tener",
    group: "动词变位",
    title: "tener 现在时变位",
    intro: "表示“有”，也常用来表达年龄、饥饿、口渴等身体感受。",
    analogy:
      "中文说“我二十岁”，西语说 tengo veinte años，字面像“我有二十年”。遇到年龄和身体感觉，先想到 tener。",
    conjugations: conjugations(["tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"]),
    examples: [
      {
        spanish: "Tengo un libro.",
        chinese: "我有一本书。",
        reason: "拥有，用 tener。"
      },
      {
        spanish: "Tiene hambre.",
        chinese: "他饿了。",
        reason: "身体感受，西语用 tener。"
      }
    ]
  },
  {
    slug: "ir",
    group: "动词变位",
    title: "ir 现在时变位",
    intro: "表示“去”，也能用 ir a + 动词原形表达马上要做的事。",
    analogy:
      "中文“我要去”“我准备去”不改变“去”本身；西语 ir 是高频不规则动词，要把 voy, vas, va 当整组记。",
    conjugations: conjugations(["voy", "vas", "va", "vamos", "vais", "van"]),
    examples: [
      {
        spanish: "Voy al mercado.",
        chinese: "我去市场。",
        reason: "移动方向，用 ir。"
      },
      {
        spanish: "Vamos a estudiar.",
        chinese: "我们要学习。",
        reason: "近期计划，用 ir a。"
      }
    ]
  },
  {
    slug: "querer",
    group: "动词变位",
    title: "querer 现在时变位",
    intro: "表示“想要、喜欢、爱”，e 在多数人称中变成 ie。",
    analogy:
      "中文靠“想”“要”“喜欢”区分语气；西语 querer 一个词覆盖很宽，变位时注意 quiero, quieres 里的 ie。",
    conjugations: conjugations(["quiero", "quieres", "quiere", "queremos", "queréis", "quieren"]),
    examples: [
      {
        spanish: "Quiero café.",
        chinese: "我想要咖啡。",
        reason: "愿望，用 querer。"
      },
      {
        spanish: "Te quiero.",
        chinese: "我爱你。",
        reason: "亲近关系里也用 querer。"
      }
    ]
  },
  {
    slug: "poder",
    group: "动词变位",
    title: "poder 现在时变位",
    intro: "表示“能够、可以”，o 在多数人称中变成 ue。",
    analogy:
      "中文“我会说”“我可以去”不改变“会/可以”；西语 poder 要跟主语变，puedo 是零基础阶段最高频的请求句入口。",
    conjugations: conjugations(["puedo", "puedes", "puede", "podemos", "podéis", "pueden"]),
    examples: [
      {
        spanish: "Puedo hablar español.",
        chinese: "我会说西班牙语。",
        reason: "能力，用 poder。"
      },
      {
        spanish: "¿Puedes ayudarme?",
        chinese: "你可以帮我吗？",
        reason: "请求许可或帮助，用 poder。"
      }
    ]
  },
  {
    slug: "noun-gender",
    group: "名词性别",
    title: "名词阴阳性规则",
    intro: "西语名词通常有阳性或阴性，冠词和形容词要跟着一致。",
    analogy:
      "中文名词没有语法性别，所以“桌子、书、城市”不会影响后面的词；西语要先给名词贴上阳性或阴性标签。",
    rules: [
      "多数 -o 结尾名词是阳性：el libro, el vaso。",
      "多数 -a 结尾名词是阴性：la casa, la mesa。",
      "-ción, -sión, -dad 结尾常为阴性：la canción, la ciudad。",
      "常见例外要单独记：el día 是阳性，la mano 是阴性。"
    ],
    examples: [
      {
        spanish: "el libro rojo",
        chinese: "红色的书",
        reason: "libro 是阳性，所以用 el 和 rojo。"
      },
      {
        spanish: "la casa roja",
        chinese: "红色的房子",
        reason: "casa 是阴性，所以用 la 和 roja。"
      }
    ]
  },
  {
    slug: "ser-vs-estar",
    group: "常见辨析",
    title: "ser vs estar 辨析",
    intro: "两个词都能译成“是”，但 ser 看身份和本质，estar 看状态和位置。",
    analogy:
      "中文一个“是/在”能解决很多情况；西语会追问：这是身份本质，还是此刻状态？这个判断比中文更细。",
    comparison: {
      ser: [
        {
          spanish: "Soy profesora.",
          chinese: "我是老师。",
          reason: "因为这是职业身份，所以用 ser。"
        },
        {
          spanish: "El café es colombiano.",
          chinese: "这咖啡是哥伦比亚的。",
          reason: "因为这是来源和属性，所以用 ser。"
        },
        {
          spanish: "La clase es interesante.",
          chinese: "这节课很有意思。",
          reason: "因为这是评价本质特征，所以用 ser。"
        }
      ],
      estar: [
        {
          spanish: "Estoy en la escuela.",
          chinese: "我在学校。",
          reason: "因为这是位置，所以用 estar。"
        },
        {
          spanish: "El café está caliente.",
          chinese: "咖啡现在是热的。",
          reason: "因为这是当前状态，所以用 estar。"
        },
        {
          spanish: "La clase está cancelada.",
          chinese: "这节课取消了。",
          reason: "因为这是临时结果状态，所以用 estar。"
        }
      ]
    },
    related: [
      { label: "查看相关语法 → ser 变位", slug: "ser" },
      { label: "查看相关语法 → estar 变位", slug: "estar" }
    ]
  }
];

export const grammarGroups: GrammarGroup[] = ["动词变位", "名词性别", "常见辨析"];

export function getGrammarTopic(slug: string) {
  return grammarTopics.find((topic) => topic.slug === slug);
}
