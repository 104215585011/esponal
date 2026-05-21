export type FoundationComparisonRow = {
  spanish: string;
  english: string;
  chinese: string;
  example: {
    es: string;
    en: string;
    zh: string;
  };
};

export type FoundationLesson = {
  day: number;
  title: string;
  subtitle: string;
  duration: string;
  words: string[];
  sections: {
    引入: string[];
    对照表: string;
    西英差异: string[];
    真实使用: string[];
  };
  comparisonRows: FoundationComparisonRow[];
  contrastBlocks: string[];
  usageExamples: FoundationComparisonRow["example"][];
};

export const foundationLessons: FoundationLesson[] = [
  {
    day: 1,
    title: "主语代词：先别急着背动词",
    subtitle: "yo / tú / él / ella / usted / nosotros / vosotros / ellos",
    duration: "6 分钟",
    words: ["yo", "tú", "él", "ella", "usted", "nosotros", "vosotros", "ellos"],
    sections: {
      引入: [
        "第一天先看主语代词，因为它们决定一句话是谁在行动。英语里 I, you, he, she 几乎总要说出来，西语却经常把主语藏在动词变化里。你看到 Hablo español，不要慌，它不是少了 I，而是 hablo 这个词尾已经告诉你说话的人是我。这个习惯会让中文母语者一开始很不适应，因为中文和英语都更依赖显性的主语。先建立这个模型，后面学 ser、estar、tener、ir 这些高频动词时，句子会立刻清楚很多。",
        "主语代词不是要你每句都背一遍，而是用来校准视角。yo 是我，tú 是熟人之间的你，usted 是礼貌或有距离感的你；nosotros 是我们，vosotros 主要在西班牙口语里常见，拉美更多用 ustedes 表示你们。él 和 ella 对应他和她，ellos 和 ellas 对应他们和她们。真正阅读时，你要做的不是机械翻译每个代词，而是判断这个代词有没有被强调、对比或澄清。比如 Yo soy Ana 强调的是“我是 Ana”，而 Soy Ana 通常就够了。"
      ],
      对照表: "先把人称关系摆平。下面的对照不是为了让你孤立背词，而是让你看到西语怎样把人称信息交给动词词尾。",
      西英差异: [
        "西语和英语最大的差异是主语省略。英语说 I speak，主语 I 不能丢；西语说 Hablo，动词尾 -o 已经说明是第一人称单数。主语代词出现时，往往带有强调、对比、纠正或礼貌距离。Tú estudias 和 Estudias 都是你学习，但前者更像把“你”点出来。Usted usa la misma forma que él/ella，这是初学者很容易混的地方：usted 意思是 you，动词形式却像第三人称。",
        "另一个差异是性别和群体。nosotros 可以是一群男性，也可以是男女混合；nosotras 只用于全女性群体。ellos 和 ellas 也一样。英语 they 不显示性别，西语在代词上会显示。这个性别信息不必让你焦虑，它更多是帮助你读懂谁被提到。你先会识别，再慢慢在输出时练习即可。"
      ],
      真实使用: [
        "真实语料里主语代词的密度比课本低。你会大量看到 Soy de China、Tengo una pregunta、Vamos al mercado 这种没有显性主语的句子。看到这些句子时，先看动词尾，再补出人称。反过来，当文本写 Yo no quiero eso 或 Ella sí sabe，代词常常表示强调或对比。你可以把主语代词理解成聚光灯：平时舞台已经有人，只有需要强调时才把灯打到那个人身上。",
        "今天的目标很小：读句子时能分辨主语代词；看到省略主语时不觉得缺东西；知道 usted 是礼貌的 you，但搭配第三人称动词。这个认知比死背八个词更重要。",
        "如果你想给自己一个检查动作，就拿任何一句含动词的西语问：谁在做？这个谁有没有被明说？如果没明说，动词尾有没有给线索？这个动作会让后面的时态和变位学习有落点。以后遇到新动词，也先别急着背完整表，先看它在句子里服务于哪个人称。"
      ]
    },
    comparisonRows: [
      {
        spanish: "yo",
        english: "I",
        chinese: "我",
        example: { es: "Yo soy Ana.", en: "I am Ana.", zh: "我是 Ana。" }
      },
      {
        spanish: "tú",
        english: "you",
        chinese: "你，熟人之间",
        example: { es: "Tú estudias español.", en: "You study Spanish.", zh: "你学习西语。" }
      },
      {
        spanish: "usted",
        english: "you",
        chinese: "您，礼貌或有距离",
        example: { es: "Usted vive aquí.", en: "You live here.", zh: "您住在这里。" }
      },
      {
        spanish: "nosotros",
        english: "we",
        chinese: "我们",
        example: { es: "Nosotros vamos juntos.", en: "We go together.", zh: "我们一起去。" }
      }
    ],
    contrastBlocks: [
      "Hablo español. / I speak Spanish. / 我说西语。这里没有 yo，因为动词 hablo 已经给出“我”。",
      "Yo hablo español, pero ella habla inglés. / I speak Spanish, but she speaks English. / 我说西语，但她说英语。yo 和 ella 被拿来对比，所以出现。",
      "¿Usted es profesor? / Are you a teacher? / 您是老师吗？意思是 you，但动词 es 和 él/ella 一样。"
    ],
    usageExamples: [
      { es: "Soy de Pekín.", en: "I am from Beijing.", zh: "我来自北京。" },
      { es: "Ella no está en casa.", en: "She is not at home.", zh: "她不在家。" },
      { es: "Nosotros tenemos tiempo.", en: "We have time.", zh: "我们有时间。" }
    ]
  },
  {
    day: 2,
    title: "冠词：西语名词前的小开关",
    subtitle: "el / la / los / las / un / una / unos / unas",
    duration: "7 分钟",
    words: ["el", "la", "los", "las", "un", "una", "unos", "unas"],
    sections: {
      引入: [
        "第二天讲冠词。英语里 a 和 the 已经很烦，西语还多了性别和数量：el libro, la casa, los libros, las casas。你不用把它理解成每个物体真的有男性女性，而要理解成名词自带一个语法标签。冠词的任务就是把这个标签在句子开头亮出来，让后面的形容词、指示词、代词都知道该怎样配合。对中文母语者来说，这一步最陌生；对学过英语的人来说，the/a 的“确定或不确定”概念已经有了，只是西语把它做得更细。",
        "定冠词 el/la/los/las 大致对应 the，不定冠词 un/una/unos/unas 大致对应 a/an/some。关键不是逐字翻译，而是判断说话者是否假设听者知道这个东西。Veo un perro 是我看到一只狗，狗还没进入共同语境；El perro es pequeño 是那只狗已经被我们知道。西语还比英语更常用定冠词，比如 El español es bonito 说的是“西语很美”，语言名前面通常带 el。"
      ],
      对照表: "冠词表面短，信息量很大：确定性、单复数、语法性别都挤在一个小词里。",
      西英差异: [
        "英语冠词主要处理已知与未知，西语冠词还强制显示性别和数量。book 可以直接接 the/a，libro 前面却要 el 或 un；house 是 the/a，casa 前面要 la 或 una。初学时不要试图从现实意义推断性别，先跟着词典和常见搭配记。性别不是文化判断，而是语法分类。",
        "第二个差异是抽象名词和泛指。英语说 Spanish is useful，西语常说 El español es útil。英语有时不用冠词，西语反而要用。还有 Me gusta el café，字面像“the coffee pleases me”，实际是“我喜欢咖啡”。所以看到 el/la 不要马上机械翻成“这个/那个”，它也可能只是西语在泛指一类东西。"
      ],
      真实使用: [
        "阅读时，冠词是定位名词边界的好工具。看到 una casa blanca，你可以把 una casa 看成一个名词块，blanca 是它的形容。看到 los días、las manos、el agua，你先不要急着查每个内容词，先确认它们是复数还是单数，是确定还是不确定。拆句子时，冠词像小铆钉，把名词固定在句子骨架上。",
        "今天不用追求冠词零错误，只需要养成一个阅读动作：每次看到 el/la/un/una，马上问自己它后面带的是哪个名词，这个名词是单数还是复数，是否已经在语境中出现。这个动作会让长句变短。",
        "冠词错误在输出时很常见，不必因此停住。输入阶段先把它当成路牌：它告诉你后面要来一个名词块，也提醒你这个名词块会带着性别和数量继续影响后面的形容词。读得越多，这些搭配会越像固定节奏。"
      ]
    },
    comparisonRows: [
      {
        spanish: "el",
        english: "the",
        chinese: "定冠词，阳性单数",
        example: { es: "El libro está aquí.", en: "The book is here.", zh: "那本书在这里。" }
      },
      {
        spanish: "la",
        english: "the",
        chinese: "定冠词，阴性单数",
        example: { es: "La casa es grande.", en: "The house is big.", zh: "那座房子很大。" }
      },
      {
        spanish: "los",
        english: "the",
        chinese: "定冠词，阳性或混合复数",
        example: { es: "Los niños juegan.", en: "The children play.", zh: "孩子们在玩。" }
      },
      {
        spanish: "las",
        english: "the",
        chinese: "定冠词，阴性复数",
        example: { es: "Las flores son rojas.", en: "The flowers are red.", zh: "这些花是红的。" }
      },
      {
        spanish: "un",
        english: "a / an",
        chinese: "不定冠词，阳性单数",
        example: { es: "Veo un perro.", en: "I see a dog.", zh: "我看见一只狗。" }
      },
      {
        spanish: "una",
        english: "a / an",
        chinese: "不定冠词，阴性单数",
        example: { es: "Tengo una idea.", en: "I have an idea.", zh: "我有一个想法。" }
      },
      {
        spanish: "unas",
        english: "some",
        chinese: "一些，阴性复数",
        example: { es: "Tengo unas preguntas.", en: "I have some questions.", zh: "我有一些问题。" }
      }
    ],
    contrastBlocks: [
      "El español es útil. / Spanish is useful. / 西语有用。英语不用 the，西语常用 el 来泛指语言。",
      "Tengo un problema. / I have a problem. / 我有一个问题。un 表示这个问题第一次被引入。",
      "El problema es simple. / The problem is simple. / 这个问题很简单。问题已经进入语境，所以换成 el。"
    ],
    usageExamples: [
      { es: "Las manos están limpias.", en: "The hands are clean.", zh: "手是干净的。" },
      { es: "Quiero una mesa cerca de la ventana.", en: "I want a table near the window.", zh: "我想要靠窗的一张桌子。" },
      { es: "Los niños juegan en el parque.", en: "The children play in the park.", zh: "孩子们在公园玩。" }
    ]
  },
  {
    day: 3,
    title: "反身和宾语代词：小词改变动作方向",
    subtitle: "me / te / se / nos / os / lo / la / le / los / las / les",
    duration: "8 分钟",
    words: ["me", "te", "se", "nos", "os", "lo", "la", "le", "los", "las", "les"],
    sections: {
      引入: [
        "第三天进入代词里最容易卡住的一层：反身代词和宾语代词。英语里 I wash my hands 会把 my hands 明说出来，西语常说 Me lavo las manos，字面更像“我给自己洗手”。me 不是简单的 me，而是在告诉你动作回到说话者身上。Se llama Ana 也不是“她叫自己 Ana”那么别扭，而是西语表达姓名的固定结构。先别急着把每个 se 翻译出来，先判断它在句子里让动作指向谁。",
        "宾语代词 lo/la/le/los/las/les 则负责替代已经知道的人或物。Veo el libro 可以变成 Lo veo；Conozco a María 可以说 La conozco；Le doy el libro a Ana 里的 le 表示“给她”。英语的 him/her/it/them 和西语有相似点，但西语的代词位置更靠前，常放在变位动词之前。这个位置变化会让初学者误以为句子缺主语，其实它只是先告诉你动作的承受者。"
      ],
      对照表: "今天的核心不是把所有代词一次性输出正确，而是看懂这些小词怎样改变动作方向。",
      西英差异: [
        "反身结构是西语比英语更密的地方。Me levanto, te llamas, se vende, nos vemos 都会出现反身或类似反身的标记。英语经常用普通动词表达，西语却把动作是否回到主体、是否泛指、是否被动化都交给 se 这类小词。TODO: se 的被动和无人称用法较进阶，本课只作为识别提示，不要求掌握。",
        "宾语代词的难点在位置和性别。英语说 I see it，宾语在动词后；西语说 Lo veo，lo 在变位动词前。lo/la 的选择常跟被替代名词的性别有关，不是跟现实世界的自然性别完全对应。le/les 多用于间接宾语，相当于 to him / to her / to them。不同地区有 leísmo 等差异，A1 阶段先按标准模式识别即可。"
      ],
      真实使用: [
        "你在视频和阅读里会非常频繁地遇到 me, te, se。比如 No sé 里的 sé 是 saber 的我知道，不是反身；Se llama 里的 se 是姓名结构；Me gusta 里的 me 是“对我而言”。这些都提醒你：不要只靠词形孤立判断，要看动词和句型。拆解器会把它们标成骨架词，帮助你先看到句子内部的指向。",
        "今天的练习动作是：看到 me/te/se/lo/la/le，先停半秒，问它指向谁、替代谁、跟哪个动词绑定。只要这个动作建立起来，之后学 gustar、llamarse、levantarse、dar 这类高频结构都会轻很多。",
        "不要害怕一个代词有多种功能。真实阅读里，你先做粗分类就够了：它是动作的承受者，还是动作回到主体，还是固定句型的一部分。分到这三类，理解通常已经前进了一大步。"
      ]
    },
    comparisonRows: [
      {
        spanish: "me",
        english: "me / myself",
        chinese: "我，给我，我自己",
        example: { es: "Me lavo las manos.", en: "I wash my hands.", zh: "我洗手。" }
      },
      {
        spanish: "se",
        english: "himself / herself / itself / themselves",
        chinese: "自己；也用于多种固定结构",
        example: { es: "Se llama Ana.", en: "Her name is Ana.", zh: "她叫 Ana。" }
      },
      {
        spanish: "lo",
        english: "it / him",
        chinese: "它/他，阳性直接宾语",
        example: { es: "Lo veo.", en: "I see it.", zh: "我看见它。" }
      },
      {
        spanish: "le",
        english: "to him / to her",
        chinese: "给他/她，间接宾语",
        example: { es: "Le doy agua.", en: "I give him water.", zh: "我给他水。" }
      }
    ],
    contrastBlocks: [
      "Me llamo Li. / My name is Li. / 我叫李。字面结构含 me，但中文和英语通常不翻出来。",
      "La conozco. / I know her. / 我认识她。la 放在动词前，替代 María 这类阴性直接宾语。",
      "Nos vemos mañana. / We will see each other tomorrow. / 我们明天见。nos 表示动作发生在我们之间。"
    ],
    usageExamples: [
      { es: "Te entiendo.", en: "I understand you.", zh: "我理解你。" },
      { es: "Se venden libros.", en: "Books are sold.", zh: "这里卖书。" },
      { es: "Les escribo un mensaje.", en: "I write them a message.", zh: "我给他们写一条消息。" }
    ]
  },
  {
    day: 4,
    title: "介词：句子里的方向和关系",
    subtitle: "a / de / en / con / por / para / sin / sobre / hasta / desde",
    duration: "8 分钟",
    words: ["a", "de", "en", "con", "por", "para", "sin", "sobre", "hasta", "desde"],
    sections: {
      引入: [
        "第四天是重头戏：介词。介词本身通常没有画面，却决定名词和动词之间是什么关系。a 指向目标、方向、接受者或人称宾语；de 表示来源、所属、材料或主题；en 表示在某处、在某时、以某种状态；con 是和、用、带着；por 和 para 都常被翻成 for，但一个偏原因、路径、交换、经过，一个偏目的、对象、期限、用途。把介词当成孤立词背，会很挫败；把它们当成关系标签，反而清楚。",
        "英语学习者有优势，因为 to/from/in/with/for 这些概念你已经熟悉。问题是西语并不一一对应。Voy a Madrid 是去马德里，Empiezo a estudiar 是开始学习，Veo a María 里的 a 只是标记人的直接宾语。Estoy en casa 是在家，Pienso en ti 是想到你。介词像胶水，把动作、地点、对象、原因黏起来。读句子时先把介词短语圈出来，长句会立刻分段。"
      ],
      对照表: "介词的中文翻译必须灵活看上下文，下面只给最常见的入口意思。",
      西英差异: [
        "a 的 personal a 是英语没有的结构。Veo a María 不能按 to 翻译，它只是因为 María 是具体的人，所以直接宾语前加 a。看见一张桌子是 Veo una mesa，不加 a；看见 María 是 Veo a María。初学阶段只要记住“具体的人作直接宾语时常有 a”，就能读懂很多句子。",
        "por vs para 不要用一个中文词硬压。para 常指目的、去向、接收者、期限：Estudio para aprender，Este regalo es para ti。por 常指原因、交换、经过、持续时间：Gracias por tu ayuda，Paso por el parque，Trabajo por dinero。TODO: por/para 的边界有很多细分，本课只建立大方向，例外留给后续校对。"
      ],
      真实使用: [
        "真实输入里介词短语极密：en la mañana, con mis amigos, de mi ciudad, para aprender, por eso。它们通常不是最该查词的地方，而是最该识别的骨架。你可以先把句子切成动词核心和介词块：Voy / a la escuela / con mi hermano / por la mañana。这样即使 escuela 或 hermano 不熟，也知道关系结构。",
        "今天的目标是建立介词敏感度。看到 a/de/en/con/por/para，不要急着翻译成唯一中文，先问：它连接了哪两个东西？是方向、来源、位置、陪伴、原因还是目的？这个问题比背“a=到”更可靠。",
        "介词最适合在整句里学。每次遇到一个介词短语，就连同前后的词一起读出来，而不是只背介词本身。a Madrid、de China、con agua、para ti 这种小块会慢慢变成自动识别，也会帮助你听懂口语里的快速连读。"
      ]
    },
    comparisonRows: [
      {
        spanish: "a",
        english: "to / at",
        chinese: "向、到、给；人称宾语标记",
        example: { es: "Voy a Madrid.", en: "I go to Madrid.", zh: "我去马德里。" }
      },
      {
        spanish: "de",
        english: "of / from",
        chinese: "的、来自、关于",
        example: { es: "Soy de China.", en: "I am from China.", zh: "我来自中国。" }
      },
      {
        spanish: "en",
        english: "in / on / at",
        chinese: "在……里/上/某处",
        example: { es: "Estoy en casa.", en: "I am at home.", zh: "我在家。" }
      },
      {
        spanish: "con",
        english: "with",
        chinese: "和、用、带着",
        example: { es: "Café con leche.", en: "Coffee with milk.", zh: "加奶咖啡。" }
      },
      {
        spanish: "por",
        english: "for / by / through",
        chinese: "因为、经过、交换",
        example: { es: "Gracias por tu ayuda.", en: "Thanks for your help.", zh: "谢谢你的帮助。" }
      },
      {
        spanish: "para",
        english: "for / in order to",
        chinese: "为了、给、面向",
        example: { es: "Estudio para viajar.", en: "I study in order to travel.", zh: "我学习是为了旅行。" }
      }
    ],
    contrastBlocks: [
      "Veo a Ana. / I see Ana. / 我看见 Ana。a 不翻成“到”，它标记具体的人。",
      "Trabajo por la mañana. / I work in the morning. / 我上午工作。por 用于一天中的时段（上午/下午/晚上）。",
      "Este libro es para ti. / This book is for you. / 这本书是给你的。para 指向接收者。"
    ],
    usageExamples: [
      { es: "Hablo con mi madre.", en: "I talk with my mother.", zh: "我和妈妈说话。" },
      { es: "Estoy en el metro.", en: "I am on the subway.", zh: "我在地铁上。" },
      { es: "Camino desde casa hasta la escuela.", en: "I walk from home to school.", zh: "我从家走到学校。" }
    ]
  },
  {
    day: 5,
    title: "指示词和所有词：把名词放到空间里",
    subtitle: "este / ese / aquel / esto / eso / aquello / mi / tu / su / nuestro",
    duration: "7 分钟",
    words: ["este", "ese", "aquel", "esto", "eso", "aquello", "mi", "tu", "su", "nuestro"],
    sections: {
      引入: [
        "第五天把名词周围的限定词补齐。指示词回答“哪个”：este 是这个，ese 是那个，aquel 是更远的那个；esto/eso/aquello 是中性形式，常用来指一件事、一个情况或前面整段内容。所有词回答“谁的”：mi casa, tu libro, su problema, nuestro tiempo。它们和冠词一样，站在名词旁边，帮你迅速看出名词块的边界。",
        "英语 this/that 只有近和远两档，西语常见三档：este 近说话者，ese 近听话者或较远，aquel 更远、更疏离或在回忆中。中文也有这/那，但不强制三档。所有词里 su 最容易让人紧张，因为它可以是 his、her、its、your formal、their。你不必在看到 su 的第一秒就确定所有者，先知道它表示“某人的”，再回到上下文找人。"
      ],
      对照表: "这类词会随着名词性别和数量变化，先掌握核心空间和所属关系，再处理词尾。",
      西英差异: [
        "este/ese/aquel 的三档是西语空间感的重要部分。Este libro 是我手边这本，ese libro 可能是你那边那本，aquel libro 是远处那本。抽象文本里也会用这种距离：eso 可以指刚才那件事，aquello 可以指更远的过去或较疏离的事。英语 that 往往一词覆盖 ese 和 aquel，翻译时要靠语境。",
        "mi/tu/su 这组短所有词放在名词前，不带重音；mío/tuyo/suyo 等长形式常在名词后或独立使用。Mi casa 是我的房子，La casa es mía 是这房子是我的。A1 阶段先识别前置短形式即可。su 的歧义靠上下文解决，必要时西语会用 de él, de ella, de usted 来澄清。"
      ],
      真实使用: [
        "你会在课程、故事和字幕里不断看到 este problema, esa idea, mi amigo, su casa。它们看似小词，其实帮你判断说话者和名词之间的距离、关系、态度。读到 No entiendo esta frase，你立刻知道 frase 是被当前讨论的这句话；读到 Su hermano vive aquí，要回头找上下文判断是他的、她的、您的还是他们的兄弟。",
        "今天的阅读动作是把限定词和名词打包。不要把 este 单独翻译后停住，而要读成 este libro、mi madre、nuestro plan。句子里真正移动的是名词块，而这些限定词就是名词块的把手。",
        "如果 su 让你不确定，不要立刻纠结。先把 su casa 理解成“某人的家”，继续往前后看谁最可能是所有者。西语经常通过上下文补足这种信息，阅读时允许自己晚一点确定，先保证句子主线不断，理解不被打断。"
      ]
    },
    comparisonRows: [
      {
        spanish: "este",
        english: "this",
        chinese: "这个，近说话者",
        example: { es: "Este café está frío.", en: "This coffee is cold.", zh: "这杯咖啡是冷的。" }
      },
      {
        spanish: "ese",
        english: "that",
        chinese: "那个，较近或靠近听者",
        example: { es: "Ese libro es interesante.", en: "That book is interesting.", zh: "那本书有意思。" }
      },
      {
        spanish: "mi",
        english: "my",
        chinese: "我的",
        example: { es: "Mi madre trabaja hoy.", en: "My mother works today.", zh: "我妈妈今天工作。" }
      },
      {
        spanish: "su",
        english: "his / her / your / their",
        chinese: "他/她/您/他们的",
        example: { es: "Su casa está cerca.", en: "His/Her house is nearby.", zh: "他/她家在附近。" }
      }
    ],
    contrastBlocks: [
      "Esto es importante. / This is important. / 这很重要。esto 指一件事，不直接修饰名词。",
      "Este problema es simple. / This problem is simple. / 这个问题很简单。este 修饰阳性单数名词 problema。",
      "Su nombre es Ana. / His/Her name is Ana. / 他/她的名字是 Ana。su 的具体主人靠上下文。"
    ],
    usageExamples: [
      { es: "No entiendo esa palabra.", en: "I do not understand that word.", zh: "我不懂那个词。" },
      { es: "Nuestro profesor habla despacio.", en: "Our teacher speaks slowly.", zh: "我们的老师说得慢。" },
      { es: "Aquello fue difícil.", en: "That was difficult.", zh: "那件事很难。" }
    ]
  },
  {
    day: 6,
    title: "连词：把两个想法接起来",
    subtitle: "y / e / o / u / pero / sino / porque / aunque / si / cuando",
    duration: "7 分钟",
    words: ["y", "e", "o", "u", "pero", "sino", "porque", "aunque", "si", "cuando"],
    sections: {
      引入: [
        "第六天看连词。连词的作用很朴素：把两个词、两个短语、两个分句接起来。y 是 and，o 是 or，pero 是 but，porque 是 because，si 是 if，cuando 是 when。它们在词典里很小，在真实句子里却决定逻辑。内容词告诉你画面，连词告诉你画面之间的关系：并列、选择、转折、原因、条件、时间。",
        "英语学习者要特别注意 pero 和 sino。两者都可能被翻成 but，但 pero 是一般转折：Quiero ir, pero no puedo；sino 常在否定之后纠正前面的说法：No es café, sino té。也就是说，sino 更像“不是 A，而是 B”。y/o 还会为了发音变成 e/u：padre e hijo，siete u ocho。这不是新词义，只是避免两个相邻元音撞在一起。"
      ],
      对照表: "连词通常不承担实物意义，但它们决定句子的逻辑方向。",
      西英差异: [
        "pero 和 sino 是今天最值得慢看的差异。英语 but 可以覆盖很多场景，西语会区分普通转折和否定纠正。No quiero agua, sino café 的重点是“不是水，而是咖啡”；Quiero agua, pero está fría 的重点是“想要水，但是水冷”。读句子时看到 sino，往前找否定词 no、nunca、nadie，通常就能理解结构。",
        "aunque 对应 although/even though，但后面有时会牵涉虚拟式。TODO: aunque + subjunctive 的语气差别属于进阶点，本课只要求识别“让步/虽然”的关系。si 没有重音时是 if，有重音 sí 是 yes，这一点要和第七天的重音疑问词一起记。cuando 无重音可作 when/when that，引出时间从句；cuándo 有重音才是疑问“什么时候”。"
      ],
      真实使用: [
        "字幕里连词的密度非常高，因为口语喜欢把想法一段一段接起来：Y entonces..., pero no sé..., porque tengo trabajo..., si quieres...。读的时候不要把它们当噪音。一个 pero 往往意味着前后信息方向改变，一个 porque 给出原因，一个 si 打开条件。你只要抓住这些逻辑词，哪怕内容词有几个陌生，也能跟上说话者的思路。",
        "今天的目标是做逻辑标记。看到 y/o 先并列，看到 pero/sino 先转折或纠正，看到 porque 找原因，看到 si 找条件，看到 cuando 找时间。连词是句子的路标，比很多名词更影响理解。",
        "练习时可以故意只看连词，把一段话画成逻辑线：先并列，再转折，接着解释原因，最后给条件。这样做几次之后，你会发现西语长句不再是一串词，而是一条有方向的路，读起来会更安定。"
      ]
    },
    comparisonRows: [
      {
        spanish: "y",
        english: "and",
        chinese: "和，并且",
        example: { es: "Té y café.", en: "Tea and coffee.", zh: "茶和咖啡。" }
      },
      {
        spanish: "pero",
        english: "but",
        chinese: "但是，普通转折",
        example: { es: "Quiero ir, pero no puedo.", en: "I want to go, but I cannot.", zh: "我想去，但我不能。" }
      },
      {
        spanish: "sino",
        english: "but rather",
        chinese: "而是，用于否定纠正",
        example: { es: "No es té, sino café.", en: "It is not tea, but coffee.", zh: "不是茶，而是咖啡。" }
      },
      {
        spanish: "porque",
        english: "because",
        chinese: "因为",
        example: { es: "Estudio porque quiero viajar.", en: "I study because I want to travel.", zh: "我学习，因为我想旅行。" }
      }
    ],
    contrastBlocks: [
      "Juan y Ana estudian. / Juan and Ana study. / Juan 和 Ana 学习。",
      "No vivo en Madrid, sino en Sevilla. / I do not live in Madrid, but in Seville. / 我不住马德里，而是住塞维利亚。",
      "Aunque estoy cansado, sigo leyendo. / Although I am tired, I keep reading. / 虽然我累了，我继续读。"
    ],
    usageExamples: [
      { es: "Si tienes tiempo, hablamos.", en: "If you have time, we'll talk.", zh: "如果你有时间，我们聊。" },
      { es: "Cuando llego a casa, leo.", en: "When I get home, I'll read.", zh: "我到家后读书。" },
      { es: "Padre e hijo caminan juntos.", en: "Father and son walk together.", zh: "父亲和儿子一起走。" }
    ]
  },
  {
    day: 7,
    title: "关系词和疑问词：同一批词，两种任务",
    subtitle: "que / quien / donde / cuando / como / qué / quién / dónde / cuándo / cómo",
    duration: "8 分钟",
    words: ["que", "quien", "donde", "cuando", "como", "qué", "quién", "dónde", "cuándo", "cómo"],
    sections: {
      引入: [
        "第七天收束到关系词和疑问词。你会发现很多词长得几乎一样：que 和 qué，como 和 cómo，cuando 和 cuándo，donde 和 dónde。无重音时，它们常在句子内部连接信息；有重音时，它们常用于提问或感叹。Qué quieres 是你想要什么；La casa que quiero 是我想要的房子。这个重音差异非常关键，因为它能告诉你这个词是在问问题，还是在把从句接到名词或主句上。",
        "英语里 what/that/which/who/where/when/how 分工比较清楚，西语里 que 尤其高频，能做 that、which、who、what 的一部分工作。初学者看到 que 很容易想逐字翻译，结果句子越读越乱。更好的做法是先判断它是不是连接器：它前面有没有名词？它后面是不是一个小句？如果是，它往往在把后面的信息挂到前面的名词或整句话上。"
      ],
      对照表: "这一组词的关键是重音和任务：提问时通常有重音，连接时通常无重音。",
      西英差异: [
        "que 是西语骨架里最忙的词之一。Quiero que vengas 里的 que 连接两个分句；El libro que leo 里的 que 连接名词和修饰它的小句；Creo que sí 里的 que 类似英语 that。英语可以省略 that，比如 I think you are right，西语里 creo que tienes razón 的 que 通常不能随便丢。",
        "疑问词带重音符号，是阅读时非常可靠的信号。qué 是什么，quién 是谁，dónde 是哪里，cuándo 是什么时候，cómo 是怎样。间接疑问也保留重音：No sé dónde vive，不知道他住哪里。中文没有这种书写差异，英语也不靠重音符号区分，所以西语的符号反而是在帮你读句子。"
      ],
      真实使用: [
        "你在字幕里会看到大量 creo que, lo que, porque, qué, cómo。不要把所有 que 都翻成“什么”或“那”。先看有没有重音：qué 才常是“什么”；que 更多是在连接。关系从句会让句子变长，但骨架其实简单：名词 + que + 说明。La persona que vive aquí 是“住在这里的人”，que 后面的 vive aquí 修饰 persona。",
        "七天结束，你的目标不是背完所有功能词，而是获得一个拆句子的视角：先找代词、冠词、介词、连词、指示词、关系词这些骨架，再把剩下的内容词交给词典和语境。以后读任何西语句子，都先问“骨架在哪里”，理解速度会明显提高。",
        "最后给自己一个复盘动作：拿一句真实西语，先划出所有小词，再只看剩下的内容词。你会发现骨架词负责关系，内容词负责画面。两层分开之后，查词和理解都会更稳。",
        "从下一次阅读开始，不要把陌生句子看成一堵墙。先找 el/la/un/una 定住名词块，再找 a/de/en/con 切出关系，再看 que/porque/pero 判断逻辑，最后才查真正陌生的名词和动词。这个顺序会把压力降下来，也会让你更像在分析句子，而不是被句子推着走。真正熟练以后，你不一定会在心里说出这些术语，但会自然感觉到哪里是主干，哪里是补充，哪里是转折，哪里是解释。这就是骨架词课的目的：让你带着结构感进入真实输入，也让后面的查词、听力和复习都更有方向。"
      ]
    },
    comparisonRows: [
      {
        spanish: "que",
        english: "that / which",
        chinese: "连接词，关系词",
        example: { es: "Creo que es verdad.", en: "I think that it is true.", zh: "我认为这是真的。" }
      },
      {
        spanish: "qué",
        english: "what",
        chinese: "什么",
        example: { es: "¿Qué quieres?", en: "What do you want?", zh: "你想要什么？" }
      },
      {
        spanish: "donde",
        english: "where",
        chinese: "在……的地方，连接用",
        example: { es: "La ciudad donde vivo es pequeña.", en: "The city where I live is small.", zh: "我住的城市很小。" }
      },
      {
        spanish: "cómo",
        english: "how",
        chinese: "怎样，如何",
        example: { es: "¿Cómo estás?", en: "How are you?", zh: "你好吗？" }
      }
    ],
    contrastBlocks: [
      "El libro que leo es corto. / The book that I read is short. / 我读的那本书很短。",
      "¿Qué lees? / What are you reading? / 你在读什么？重音符号说明它在提问。",
      "No sé dónde está. / I do not know where it is. / 我不知道它在哪里。间接疑问仍然保留重音。"
    ],
    usageExamples: [
      { es: "La mujer que habla es mi profesora.", en: "The woman who speaks is my teacher.", zh: "正在说话的女人是我的老师。" },
      { es: "Cuando tengo tiempo, escucho podcasts.", en: "When I have time, I listen to podcasts.", zh: "我有时间时听播客。" },
      { es: "¿Quién vive aquí?", en: "Who lives here?", zh: "谁住在这里？" }
    ]
  }
];

export function getFoundationLesson(daySlug: string) {
  const match = /^day-(\d)$/.exec(daySlug);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  return foundationLessons.find((lesson) => lesson.day === day) ?? null;
}
