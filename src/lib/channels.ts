// Timestamp: 2026-11-15 02:45
export type CuratedChannel = {
  id: string;
  title: string;
  level: string;
  tag: string;
  description: string;
};

export const curatedChannels: CuratedChannel[] = [
  {
    title: "Dreaming Spanish",
    id: "UCouyFdE9-Lrjo3M_2idKq1A",
    level: "A1 入门",
    tag: "慢速可理解输入",
    description: "推荐入门，语速慢、配合画面手势，适合建立最初的可理解输入。"
  },
  {
    title: "Spanish Okay",
    id: "UCW1FQuVy10_biDAxAj1iTEQ",
    level: "A1–A2",
    tag: "日常表达",
    description: "贴近日常生活的短主题与高频表达，适合碎片时间反复磨耳朵。"
  },
  {
    title: "Easy Spanish",
    id: "UCAL4AMMMXKxHDu3FqZV6CbQ",
    level: "A2–B1",
    tag: "街头真实对话",
    description: "街头真实采访与地道口语，适合进阶适应自然语速与不同口音。"
  }
];
