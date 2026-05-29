# UI Design Mockup for LEX-003

This document specifies the design layouts, Tailwind CSS styling tokens, and interaction behaviors for displaying **Related Phrases** and the **Construction Usage Note** on the word lookup card, as well as the nesting interaction inside the stack.

---

## 1. "Related Phrases" Section Layout (Light & Dark Modes)

When a word lookup is executed and has related phrases returned in the API payload, a dedicated **"Related Phrases" (相关搭配)** section is rendered below the example sentence block and above the bottom "Add to Vocabulary" action button.

To keep the UI clean, the section is completely omitted (returns `null` in React) when there are no related phrases.

### 1.1 Styling Definition

```jsx
// Section container spacing
const relatedPhrasesContainerClasses = "mt-3.5 space-y-2";

// Section title typography (Consistent with Example Section title style)
const sectionTitleClasses = "text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider";

// Individual related phrase button item
const relatedPhraseItemClasses = 
  "flex items-center justify-between w-full text-left rounded-lg p-2 bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/40 border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800/50 transition duration-150 group";

// Badge styling for phrase kind (Collocation, Phrase, Idiom) - Reused from PHRASE-001
const kindBadgeClasses = 
  "shrink-0 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/30 dark:border-amber-800/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400";
```

### 1.2 Interactive Related Phrase List Item Structure

```jsx
<button
  type="button"
  onClick={() => onRelatedPhraseClick?.(phrase.lemma, phrase.kind)}
  className={relatedPhraseItemClasses}
>
  <div className="flex items-center gap-2 min-w-0">
    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
      {phrase.lemma}
    </span>
    <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">
      · {phrase.translationZh}
    </span>
  </div>
  <span className={kindBadgeClasses}>
    {getPhraseKindLabel(phrase.kind)}
  </span>
</button>
```

---

### 1.3 State Mockups

#### Mock 1A: 0 items (Not Rendered)
If the word has no related phrases (e.g. rare vocabulary or external lookups), the section returns `null` and leaves no margin, blank box, or border line.

```text
+------------------------------------+
|  comer                       [动词] |
|  /koˈmeɾ/                           |
|                                    |
|  1. 吃，用餐                        |
|  2. 消耗，侵蚀                      |
|                                    |
|  +------------------------------+  |
|  | 例句                          |  |
|  | Voy a comer ahora.     [ > ] |  |
|  | 我现在要吃饭了。               |  |
|  +------------------------------+  |
|  ================================  | <- border-t (divider)
|  [         加入我的词库          ] |
+------------------------------------+
```

#### Mock 1B: 1 item State (Light Mode)
```text
+------------------------------------+
|  soler                       [动词] |
|  /soˈleɾ/                           |
|                                    |
|  1. 经常，习惯于做某事               |
|                                    |
|  +------------------------------+  |
|  | 例句                          |  |
|  | Suelo leer antes de dormir.  |  |
|  | 我习惯睡前读书。                |  |
|  +------------------------------+  |
|                                    |
|  相关搭配                          | <- zinc-400 font-semibold text-xs
|  +------------------------------+  |
|  | soler + inf. · 习惯于做..[短语]|  | <- hover bg-zinc-50 border-zinc-200/50
|  +------------------------------+  |    Badge: bg-amber-50 text-amber-700
|  ================================  |
|  [         加入我的词库          ] |
+------------------------------------+
```

#### Mock 1C: 5 items State (Dark Mode)
```text
+------------------------------------+
|  tener                       [动词] |
|  /teˈneɾ/                           |
|                                    |
|  1. 有，拥有                        |
|  2. 含有，持有                      |
|                                    |
|  +------------------------------+  |
|  | 例句                          |  |
|  | Tengo un libro nuevo.        |  |
|  | 我有一本新书。                  |  |
|  +------------------------------+  |
|                                    |
|  相关搭配                          | <- zinc-500 font-semibold text-xs
|  +------------------------------+  |
|  | tener que · 必须     [固定搭配]|  | <- hover bg-zinc-800/40 border-zinc-800/50
|  | tener ganas de · 想做[固定搭配]|  |    Badge: bg-amber-950/40 text-amber-400
|  | tener cuidado · 小心   [固定搭配]|  |
|  | tener razón · 有道理   [固定搭配]|  |
|  | tener prisa · 赶时间   [固定搭配]|  |
|  +------------------------------+  |
|  ================================  |
|  [         加入我的词库          ] |
+------------------------------------+
```

---

## 2. Construction Word `usageNote` Section (Mock 2)

For words tagged with `kind="construction"` (such as *gustar* or *soler*), the API returns a `usageNote` containing crucial structural/syntactic guidance for Chinese native speakers. This is rendered as a clean, helpful tip right below the meanings list and above the example sentence box.

### 2.1 Styling Definition

```jsx
// Left accent-colored border callout box
const usageNoteContainerClasses = 
  "mt-2.5 p-2.5 bg-zinc-50 dark:bg-zinc-800/30 border-l-2 border-brand-500 dark:border-brand-500 rounded-r-lg text-xs leading-relaxed text-zinc-600 dark:text-zinc-400";

// Prefix label inside the note
const usageNoteLabelClasses = "font-semibold text-brand-600 dark:text-brand-400 mr-1.5";
```

### 2.2 JSX Component Structure

```jsx
{isReady && lookupState.usageNote && (
  <div className={usageNoteContainerClasses}>
    <span className={usageNoteLabelClasses}>用法提示</span>
    {lookupState.usageNote}
  </div>
)}
```

### 2.3 ASCII Mockup for Construction Card (Light Mode)

```text
+------------------------------------+
|  gustar                      [动词] |
|  /ɡusˈtaɾ/                          |
|                                    |
|  1. 喜欢，使人中意                  |
|                                    |
|  +------------------------------+  |
|  | 用法提示                      |  | <- border-l-2 border-brand-500 (emerald)
|  | 倒装结构：主语是令人喜欢的事物， |  |    bg-zinc-50, text-zinc-600
|  | 间接宾语(me/te/le..)表示主体。  |  |
|  +------------------------------+  |
|                                    |
|  +------------------------------+  |
|  | 例句                          |  |
|  | Me gusta esta canción.       |  |
|  | 我喜欢这首歌。                  |  |
|  +------------------------------+  |
|  ================================  |
|  [         加入我的词库          ] |
+------------------------------------+
```

---

## 3. Nested Stack Stacking Hierarchy (Mock 3)

When a user clicks on an item in the **"Related Phrases"** list (e.g. clicks `tener que` inside the card for `tener`), a new lookup card with `lookupKind="phrase"` is created and pushed onto the `LookupCardStack`. 

The visual layering pushes the bottom card back (scaled down, faded, blurred, non-interactive) and displays the new card prominently at `z-20` with a sharp drop shadow.

### 3.1 Stack Visual Hierarchy

```text
       ┌────────────────────────────────────────────────────────┐
       │ (Card 1: Bottom - Pushed Back)                         │
       │ Lemma: tener                              [动词]       │
       │ scale-[0.96] opacity-40 blur-[0.5px]                   │
       │                                                        │
       │   ┌────────────────────────────────────────────────┐   │
       │   │ (Card 2: Top - Active)                         │   │
       │   │ Lemma: tener que                  [固定搭配]   │   │
       │   │ z-20 shadow-elevated                           │   │
       │   ├────────────────────────────────────────────────┤   │
       │   │                                                │   │
       │   │  必须，不得不                                   │   │
       │   │                                                │   │
       │   │  [例] Tengo que comer agora.                   │   │
       │   │                                                │   │
       │   │  [ 关闭 ]                    [ 加入我的词库 ]  │   │
       │   └────────────────────────────────────────────────┘   │
       └────────────────────────────────────────────────────────┘
```

### 3.2 Stack Layout Layout & Transition Details

When transitioning to 2 stacked cards:
- **Card 1 Container Classes (Bottom)**: `absolute inset-x-0 bottom-0 z-10 scale-[0.96] -translate-y-3 opacity-40 blur-[0.5px] pointer-events-none select-none transition-all duration-300`
- **Card 2 Container Classes (Top)**: `relative z-20 transition-all duration-300`
- Closing the Top Card instantly removes Card 2 and returns Card 1 to `relative z-20 scale-100 translate-y-0 opacity-100 blur-none pointer-events-auto`.

---

## 4. UI Design Constraints & Checklist Audit

This design mockup strictly conforms to the **Esponal UI Design Constraints**:

1. **No Gamified Numbers (禁区 §1)**: The Related Phrases section simply presents linguistic associations. It lists no mastery percentages, memory level gauges, repetition count counters, or daily checkmark goals.
2. **No Fake AI Labels (禁区 §2)**: Avoids any AI sparkles (`✨`) or phrases like "AI recommended phrases" or "AI suggested collocations". It is simply titled "相关搭配" (Related Phrases/Collocations) and "用法提示" (Usage Note).
3. **No Already-Mastered Negatives (禁区 §3)**: Saved items in the related phrases list maintain standard typography weights without strike-throughs or visual graying out.
4. **No SRS Terminology (禁区 §4)**: No memory curves, Leitner scheduling dates, or memory algorithms appear.
5. **No Pressure Triggers (禁区 §5)**: Related phrases are displayed statically. They use zero notifications, reminders, or warning banners.
6. **No Gamified Rewards (禁区 §6)**: No medal icons, streaks, checkmarks, or success popups are added to card nesting.
7. **Chinese-Friendly UI (禁区 §7)**: Every label, badge text, translation segment, and grammatical note is presented clearly in high-quality Chinese (`用法提示`, `固定搭配`, `习语`, `短语`).
