export type GrammarGroup = "动词变位" | "名词性别" | "句型结构" | "常见辨析";

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
  },
  {
    slug: "regular-ar",
    group: "动词变位",
    title: "规则动词 -ar 变位",
    intro: "以 -ar 结尾的规则动词按固定词尾变位，是西语动词的最大类别。",
    analogy:
      "中文动词不变形，但西语动词会随人称改变。-ar 动词最多，记住词尾 -o / -as / -a / -amos / -áis / -an 就能套用所有规则 -ar 动词。",
    rules: [
      "去掉 -ar，得到词根（hablar → habl-）。",
      "yo: -o → hablo",
      "tú: -as → hablas",
      "él/ella/usted: -a → habla",
      "nosotros: -amos → hablamos",
      "vosotros: -áis → habláis",
      "ellos/ustedes: -an → hablan",
      "常见 -ar 动词：hablar（说）、trabajar（工作）、estudiar（学习）、escuchar（听）、comprar（买）。"
    ],
    examples: [
      { spanish: "Estudio español todos los días.", chinese: "我每天学西班牙语。", reason: "estudiar 是规则 -ar 动词，yo 用 -o。" },
      { spanish: "Ella trabaja en una oficina.", chinese: "她在办公室工作。", reason: "trabajar 是规则 -ar 动词，ella 用 -a。" }
    ]
  },
  {
    slug: "regular-er-ir",
    group: "动词变位",
    title: "规则动词 -er / -ir 变位",
    intro: "-er 和 -ir 结尾的规则动词共享大部分词尾，只有 nosotros / vosotros 有区别。",
    analogy:
      "可以把 -er 和 -ir 当成一对孪生：除了我们/你们那两格，其他人称的词尾完全一样。记住例外那两格，其余照抄。",
    rules: [
      "-er 词根 + 词尾：-o / -es / -e / -emos / -éis / -en（comer: como, comes, come…）",
      "-ir 词根 + 词尾：-o / -es / -e / -imos / -ís / -en（vivir: vivo, vives, vive…）",
      "区别仅在 nosotros（-emos vs -imos）和 vosotros（-éis vs -ís）。",
      "常见 -er 动词：comer（吃）、beber（喝）、leer（读）、aprender（学）。",
      "常见 -ir 动词：vivir（住）、escribir（写）、abrir（开）、subir（上）。"
    ],
    examples: [
      { spanish: "Comemos paella los domingos.", chinese: "我们周日吃海鲜饭。", reason: "comer 是规则 -er 动词，nosotros 用 -emos。" },
      { spanish: "Vivo en Pekín.", chinese: "我住在北京。", reason: "vivir 是规则 -ir 动词，yo 用 -o。" }
    ]
  },
  {
    slug: "stem-changing",
    group: "动词变位",
    title: "词干变音动词",
    intro: "部分动词在重读音节时词干元音发生变化：e→ie、o→ue、e→i，但 nosotros / vosotros 不变。",
    analogy:
      "把变化的那四个人称想成一个「靴子」形状：yo/tú/él/ellos 四格词干变了，nosotros/vosotros 夹在中间不变。",
    rules: [
      "e → ie：querer（quiero, quieres, quiere, queremos, queréis, quieren）；同类：empezar, entender, preferir。",
      "o → ue：poder（puedo, puedes, puede, podemos, podéis, pueden）；同类：dormir, volver, encontrar。",
      "e → i（仅 -ir 动词）：pedir（pido, pides, pide, pedimos, pedís, piden）；同类：servir, vestirse。",
      "nosotros 和 vosotros 永远保持原词干，不参与变音。"
    ],
    examples: [
      { spanish: "Empieza a llover.", chinese: "开始下雨了。", reason: "empezar 是 e→ie 词干变音，él 用 empieza。" },
      { spanish: "Dormimos ocho horas.", chinese: "我们睡了八小时。", reason: "dormir 是 o→ue 词干变音，nosotros 不变保持 dorm-。" }
    ],
  },
  {
    slug: "reflexive-verbs",
    group: "动词变位",
    title: "反身动词",
    intro: "动词加上反身代词 me/te/se/nos/os/se，表示动作作用于主语自身。",
    analogy:
      "中文「我洗澡」「我起床」不加「自己」；西语反身动词必须在动词前加一个反身代词，告诉对方「这个动作回到自身」。",
    rules: [
      "不定式以 -se 结尾：llamarse, levantarse, ducharse。",
      "变位时反身代词随人称变化：me / te / se / nos / os / se。",
      "代词放在变位动词前：Me llamo Ana. / ¿Cómo te llamas?",
      "常见反身动词：llamarse（叫名字）、levantarse（起床）、acostarse（睡觉）、ducharse（淋浴）、vestirse（穿衣）。"
    ],
    examples: [
      { spanish: "Me llamo Carlos.", chinese: "我叫卡洛斯。", reason: "llamarse 是反身动词，主语 yo 对应 me。" },
      { spanish: "Nos levantamos a las siete.", chinese: "我们七点起床。", reason: "levantarse 反身，nosotros 对应 nos。" }
    ]
  },
  {
    slug: "gustar",
    group: "句型结构",
    title: "gustar 型动词",
    intro: "gustar 不以「主语做动作」表达，而是「事物令人喜欢」，动词随事物（主语）变，人用间接宾语代词。",
    analogy:
      "中文说「我喜欢猫」，主语是我；西语说 Me gustan los gatos，字面是「猫让我喜欢」，主语是猫。把视角倒过来就对了。",
    rules: [
      "常用形式只有两个：gusta（后接单数名词或动词原形）、gustan（后接复数名词）。",
      "间接宾语代词：me / te / le / nos / os / les，表示「谁」受影响。",
      "强调时在前加 a + 人称：A mí me gusta / A ella le gustan。",
      "同类动词：encantar（超喜欢）、molestar（打扰）、doler（疼）、interesar（感兴趣）、parecer（觉得）。"
    ],
    examples: [
      { spanish: "Me gusta el café.", chinese: "我喜欢咖啡。", reason: "café 是单数，用 gusta；me 表示「我」受影响。" },
      { spanish: "Nos gustan las películas de acción.", chinese: "我们喜欢动作片。", reason: "películas 是复数，用 gustan；nos 表示「我们」。" }
    ]
  },
  {
    slug: "articles",
    group: "名词性别",
    title: "冠词用法",
    intro: "西语冠词分定冠词（el/la/los/las）和不定冠词（un/una/unos/unas），须与名词的阴阳性和单复数一致。",
    analogy:
      "中文没有冠词；西语冠词就像给名词贴的「标签」，告诉听者这个名词是特指还是泛指、是阳性还是阴性。",
    rules: [
      "定冠词：el（阳单）、la（阴单）、los（阳复）、las（阴复）——特指已知事物。",
      "不定冠词：un（阳单）、una（阴单）、unos（阳复）、unas（阴复）——泛指或首次提及。",
      "职业、国籍前一般不用不定冠词：Soy médico.（不加 un）",
      "星期、月份、语言名称前通常不加冠词：Hablo español. / El lunes trabajo。",
      "a + el 缩写为 al；de + el 缩写为 del。"
    ],
    examples: [
      { spanish: "Quiero un café, por favor.", chinese: "我要一杯咖啡，谢谢。", reason: "首次提及，不定冠词 un。" },
      { spanish: "El café está frío.", chinese: "这杯咖啡是凉的。", reason: "特指刚才那杯，定冠词 el。" }
    ],
    related: [{ label: "查看相关语法 → 名词阴阳性规则", slug: "noun-gender" }]
  },
  {
    slug: "adjective-agreement",
    group: "名词性别",
    title: "形容词性数一致",
    intro: "西语形容词须与所修饰名词的性（阴/阳）和数（单/复）保持一致。",
    analogy:
      "中文「红色的书」和「红色的书们」，「红色」不变；西语形容词会跟着名词变形——名词是阴性复数，形容词也得是阴性复数。",
    rules: [
      "-o/-a 结尾的形容词有四种形式：rojo / roja / rojos / rojas。",
      "-e 或辅音结尾的形容词阴阳同形，只变单复数：grande / grandes、fácil / fáciles。",
      "形容词通常放在名词后面：un coche rojo（一辆红色的车）。",
      "少数形容词放名词前且形式不同：buen/buena、mal/mala、gran。"
    ],
    examples: [
      { spanish: "Tengo un perro pequeño y una gata pequeña.", chinese: "我有一只小公狗和一只小母猫。", reason: "pequeño 跟阳性 perro，pequeña 跟阴性 gata。" },
      { spanish: "Las casas blancas son bonitas.", chinese: "那些白色的房子很漂亮。", reason: "casas 是阴性复数，blancas 和 bonitas 跟着变复数。" }
    ],
    related: [{ label: "查看相关语法 → 名词阴阳性规则", slug: "noun-gender" }]
  },
  {
    slug: "ir-a-infinitive",
    group: "句型结构",
    title: "ir a + 动词原形",
    intro: "用 ir a + 不定式表达近期计划或即将发生的事，相当于中文「要/准备/打算」。",
    analogy:
      "英语有 going to；中文有「我要」「我打算」；西语 voy a + 动词原形 就是这个结构，ir 先变位，后面动词保持原形不动。",
    rules: [
      "结构：[ir 变位] + a + [动词原形]。",
      "ir 变位：voy / vas / va / vamos / vais / van。",
      "表达将来计划比简单将来时（futuro）更口语化、更常用。",
      "否定：no + [ir 变位] + a + [动词原形]：No voy a estudiar hoy。"
    ],
    examples: [
      { spanish: "Voy a llamar a mi madre esta tarde.", chinese: "我今天下午要给我妈打电话。", reason: "voy a + llamar，表达近期计划。" },
      { spanish: "¿Vas a comer aquí?", chinese: "你要在这里吃吗？", reason: "vas a + comer，询问对方计划。" }
    ],
  }
];

export const grammarGroups: GrammarGroup[] = ["动词变位", "名词性别", "句型结构", "常见辨析"];

export function getGrammarTopic(slug: string) {
  return grammarTopics.find((topic) => topic.slug === slug);
}
