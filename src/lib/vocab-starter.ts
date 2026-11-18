// Timestamp: 2026-11-18 17:32
// 纯数据模块（无 @/ 别名依赖）：
// 起步阶段「高频骨架词与核心语块」快扫卡包，第一轮只做到看中文、听读音、混个眼熟。

export type StarterHighFreqItem = {
  id: string;
  language: "es";
  lemma: string;
  displayForm: string;
  kind: "word" | "phrase";
  posLabel: string;
  translationZh: string;
  exampleEs: string;
  exampleZh: string;
  noteZh: string;
};

export const SPANISH_STARTER_PACK: StarterHighFreqItem[] = [
  {
    id: "es-hay",
    language: "es",
    lemma: "hay",
    displayForm: "hay (haber)",
    kind: "word",
    posLabel: "高频存在动词",
    translationZh: "有；存在（there is / there are）",
    exampleEs: "Hoy hay mucha gente en el café.",
    exampleZh: "今天咖啡馆里有很多人。",
    noteZh: "不论单数复数都用 hay，西语对话最高频骨架词之一"
  },
  {
    id: "es-poder",
    language: "es",
    lemma: "poder",
    displayForm: "puede / puedo (poder)",
    kind: "word",
    posLabel: "高频情态动词",
    translationZh: "能够；可以",
    exampleEs: "¿Puede hablar un poco más despacio?",
    exampleZh: "您能说慢一点吗？",
    noteZh: "常见变化：puedo（我能）、puedes（你能）、puede（他/您能）"
  },
  {
    id: "es-tener-que",
    language: "es",
    lemma: "tener que",
    displayForm: "tengo que / tiene que + 原形",
    kind: "phrase",
    posLabel: "核心句型语块",
    translationZh: "必须……；得做某事",
    exampleEs: "Tengo que salir temprano mañana.",
    exampleZh: "我明天得早点出门。",
    noteZh: "后面直接接动词原形，套用极快，先整体认住 tiene que"
  },
  {
    id: "es-ir-a",
    language: "es",
    lemma: "ir a",
    displayForm: "voy a / va a + 原形",
    kind: "phrase",
    posLabel: "核心句型语块",
    translationZh: "打算……；将要……",
    exampleEs: "Voy a tomar un café antes de trabajar.",
    exampleZh: "上班前我打算喝杯咖啡。",
    noteZh: "口语最常用“将来时平替”，不需要背将来时词尾"
  },
  {
    id: "es-hay-que",
    language: "es",
    lemma: "hay que",
    displayForm: "hay que + 原形",
    kind: "phrase",
    posLabel: "核心句型语块",
    translationZh: "需要……；应该（泛指）",
    exampleEs: "Hay que escuchar todos los días un poco.",
    exampleZh: "每天都要稍微听一点。",
    noteZh: "不指定具体谁做，“得做某事”的地道高频表达"
  },
  {
    id: "es-acabar-de",
    language: "es",
    lemma: "acabar de",
    displayForm: "acabo de / acaba de + 原形",
    kind: "phrase",
    posLabel: "核心句型语块",
    translationZh: "刚刚做完某事",
    exampleEs: "Acabo de llegar a casa.",
    exampleZh: "我刚回到家。",
    noteZh: "用现在时就能轻松表达“刚刚发生”，超实用"
  },
  {
    id: "es-querer",
    language: "es",
    lemma: "querer",
    displayForm: "quiero / quiere (querer)",
    kind: "word",
    posLabel: "高频动词",
    translationZh: "想要；爱",
    exampleEs: "Quiero comprar fruta en el mercado.",
    exampleZh: "我想去市场买水果。",
    noteZh: "点餐与日常表达必备：quiero...（我想要……）"
  },
  {
    id: "es-hacer",
    language: "es",
    lemma: "hacer",
    displayForm: "hago / hace (hacer)",
    kind: "word",
    posLabel: "高频万金油动词",
    translationZh: "做；制作；（天气）怎样",
    exampleEs: "Hoy hace muy buen tiempo.",
    exampleZh: "今天天气非常好。",
    noteZh: "既表示“做某事”，也常用于天气（hace frío）和时间（hace dos días）"
  },
  {
    id: "es-saber",
    language: "es",
    lemma: "saber",
    displayForm: "sé / sabe (saber)",
    kind: "word",
    posLabel: "高频动词",
    translationZh: "知道（事实）；会（某项技能）",
    exampleEs: "No sé dónde está la estación.",
    exampleZh: "我不知道车站在哪里。",
    noteZh: "第一人称单数是超短的 sé（知道）"
  },
  {
    id: "es-decir",
    language: "es",
    lemma: "decir",
    displayForm: "digo / dice / dijo (decir)",
    kind: "word",
    posLabel: "高频动词",
    translationZh: "说；告诉",
    exampleEs: "¿Qué quiere decir esta palabra?",
    exampleZh: "这个词是什么意思？",
    noteZh: "搭配 querer decir = “意思是……”"
  },
  {
    id: "es-quedar",
    language: "es",
    lemma: "quedar",
    displayForm: "queda / me quedo (quedar)",
    kind: "word",
    posLabel: "高频多义核心词",
    translationZh: "剩下；约定见面；留在某地",
    exampleEs: "Solo queda un billete para hoy.",
    exampleZh: "今天只剩最后一张票了。",
    noteZh: "高频多面手：只剩（queda）、约见（quedamos）、留下（me quedo）"
  },
  {
    id: "es-llevar",
    language: "es",
    lemma: "llevar",
    displayForm: "llevo / lleva (llevar)",
    kind: "word",
    posLabel: "高频核心动词",
    translationZh: "带走；穿着；做某事已持续多久",
    exampleEs: "Llevo tres meses estudiando español.",
    exampleZh: "我学西班牙语已经三个月了。",
    noteZh: "“llevar + 时间 + 现在分词”是表示持续多久的高频神句型"
  },
  {
    id: "es-dar",
    language: "es",
    lemma: "dar",
    displayForm: "doy / da / me da igual",
    kind: "word",
    posLabel: "高频核心动词",
    translationZh: "给；产生；触发搭配",
    exampleEs: "A mí me da igual, como tú prefieras.",
    exampleZh: "我都可以，看你喜欢。",
    noteZh: "常配合搭配出现：dar un paseo（散步）、me da igual（无所谓）"
  },
  {
    id: "es-me-gusta",
    language: "es",
    lemma: "gustar",
    displayForm: "me gusta / me gustan",
    kind: "phrase",
    posLabel: "高频结构",
    translationZh: "我喜欢……（某物使我喜欢）",
    exampleEs: "Me gusta mucho caminar por la mañana.",
    exampleZh: "我非常喜欢早上散步。",
    noteZh: "喜欢单数物/动词用 me gusta，复数物品用 me gustan"
  },
  {
    id: "es-hace-falta",
    language: "es",
    lemma: "hacer falta",
    displayForm: "hace falta / me hace falta",
    kind: "phrase",
    posLabel: "核心句型语块",
    translationZh: "需要……；缺少……",
    exampleEs: "No hace falta llevar paraguas.",
    exampleZh: "不需要带伞。",
    noteZh: "口语中说“不用了 / 还缺……”最自然的表达"
  },
  {
    id: "es-creo-que",
    language: "es",
    lemma: "creo que",
    displayForm: "creo que...",
    kind: "phrase",
    posLabel: "高频观点语块",
    translationZh: "我觉得……；我认为……",
    exampleEs: "Creo que es una buena idea.",
    exampleZh: "我觉得这是个好主意。",
    noteZh: "表达自己看法时的万金油开头"
  },
  {
    id: "es-porque",
    language: "es",
    lemma: "porque",
    displayForm: "porque",
    kind: "word",
    posLabel: "高频连接词",
    translationZh: "因为",
    exampleEs: "Me quedo en casa porque llueve mucho.",
    exampleZh: "我待在家里，因为雨下得很大。",
    noteZh: "连写不加空格是“因为”；分开 ¿por qué? 是“为什么”"
  },
  {
    id: "es-pero",
    language: "es",
    lemma: "pero",
    displayForm: "pero",
    kind: "word",
    posLabel: "高频连接词",
    translationZh: "但是；可是",
    exampleEs: "Es corto, pero muy útil.",
    exampleZh: "它很短，但是很有用。",
    noteZh: "转折听力抓重点词：听到 pero 后面往往是真正意图"
  },
  {
    id: "es-aunque",
    language: "es",
    lemma: "aunque",
    displayForm: "aunque",
    kind: "word",
    posLabel: "高频连接词",
    translationZh: "虽然；即使",
    exampleEs: "Salimos a caminar, aunque hace frío.",
    exampleZh: "虽然天冷，我们还是出门散步了。",
    noteZh: "口语和阅读出现频率极高的让步连词"
  },
  {
    id: "es-todavia",
    language: "es",
    lemma: "todavía",
    displayForm: "todavía / todavía no",
    kind: "word",
    posLabel: "高频副词",
    translationZh: "仍然；还 / 还没有",
    exampleEs: "Todavía no he desayunado.",
    exampleZh: "我还没有吃早饭。",
    noteZh: "与 ya（已经）正好配对，在时间脉络里极为常见"
  },
  {
    id: "es-ya",
    language: "es",
    lemma: "ya",
    displayForm: "ya / ya no",
    kind: "word",
    posLabel: "高频小词",
    translationZh: "已经；这就 / 不再",
    exampleEs: "Ya estoy en camino.",
    exampleZh: "我已经在路上了。",
    noteZh: "短小但几乎每页都会出现：ya voy（这就来）、ya no（不再）"
  },
  {
    id: "es-sin-embargo",
    language: "es",
    lemma: "sin embargo",
    displayForm: "sin embargo",
    kind: "phrase",
    posLabel: "高频连接语块",
    translationZh: "然而；不过",
    exampleEs: "Estudió poco; sin embargo, entendió casi todo.",
    exampleZh: "他学得不多；不过几乎全听懂了。",
    noteZh: "阅读博客与短文中最常见的逻辑转折过渡语块"
  },
  {
    id: "es-por-eso",
    language: "es",
    lemma: "por eso",
    displayForm: "por eso",
    kind: "phrase",
    posLabel: "高频连接语块",
    translationZh: "所以；因此",
    exampleEs: "Estaba cansado, por eso se fue pronto.",
    exampleZh: "他当时累了，所以很早就走了。",
    noteZh: "直接连接前因后果，听对话和读故事很好抓逻辑"
  },
  {
    id: "es-de-verdad",
    language: "es",
    lemma: "de verdad",
    displayForm: "¿de verdad? / de verdad",
    kind: "phrase",
    posLabel: "日常回应语块",
    translationZh: "真的吗；确实",
    exampleEs: "¿De verdad vienes mañana?",
    exampleZh: "你明天真的要来吗？",
    noteZh: "互动感极强的口语高频短语"
  }
];

export function getStarterPackByLanguage(lang: string): StarterHighFreqItem[] {
  if (lang === "es") return SPANISH_STARTER_PACK;
  return [];
}
