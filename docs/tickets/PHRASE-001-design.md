# UI Design Mockup for PHRASE-001

This document specifies the design layouts, Tailwind CSS styling tokens, interaction behaviors, and component architectures for the **Phrase Highlighting, Lookup Card Stack, and Nested Word Lookup** features.

---

## 1. Phrase Highlighting Mock (Light & Dark Modes)

Collocations, phrases, and idioms are highlighted in the Spanish text using a soft amber background fill with a subtle bottom border. This distinguishes phrases from saved words (which use dashed outlines/underlines) and prevents visual collision.

### 1.1 Highlight Styling Definition

```jsx
// Tailwind classes for the outer phrase span wrapper
const phraseHighlightClasses = 
  "phrase-highlight inline bg-amber-100/50 dark:bg-amber-950/30 border-b border-amber-200/40 dark:border-amber-900/30 rounded px-1 py-0.5 mx-0.5 transition-colors duration-150 hover:bg-amber-200/50 dark:hover:bg-amber-900/45 cursor-pointer";
```

### 1.2 ASCII Mockup in Reading Flow

#### Light Mode
```text
  No tengo prisa, pero tengo que comer ahora en la mesa.
                        └─────────┘
                       [ Tengo que ] <- bg-amber-100/50 border-b border-amber-200/40
                                        Text: zinc-900
```

#### Dark Mode
```text
  No tengo prisa, pero tengo que comer ahora en la mesa.
                        └─────────┘
                       [ Tengo que ]  <- bg-amber-950/30 border-b border-amber-900/30
                                        Text: zinc-50
```

---

## 2. Card Visual Comparison: Word vs. Phrase Lookup Card

Both cards share a unified layout shell to maintain visual consistency, but the Phrase Lookup Card has a distinct top color accent bar (Amber) and a `[固定搭配]` (or `[短语]` / `[成语]`) status badge.

### 2.1 Word Lookup Card (Default style)

*   **Top Bar:** Clean, no accent bar.
*   **Header Badge:** Muted zinc badge indicating part of speech (e.g., `动词`, `名词`, `形容词`).

#### JSX/Tailwind Structure
```jsx
<div className="relative overflow-hidden w-full rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-4 shadow-elevated">
  {/* Card Header */}
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-50">comer</p>
        <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          动词
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">/koˈmeɾ/</p>
    </div>
    <button className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
      关闭
    </button>
  </div>
  
  {/* Meanings */}
  <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
    <ol className="list-decimal pl-4 space-y-1">
      <li>吃，用餐</li>
      <li>消耗，侵蚀</li>
    </ol>
  </div>
</div>
```

---

### 2.2 Phrase Lookup Card (New style)

*   **Top Accent Bar:** A solid 4px tall amber bar at the very top of the card.
*   **Header Badge:** Amber-colored badge matching the phrase kind: `[固定搭配]` (collocation), `[短语]` (phrase), or `[成语/习语]` (idiom).
*   **Example Sentences:** Words within the Spanish example sentences must be interactive (wrapped in `SpanishText` to allow nested word lookup clicks).

#### JSX/Tailwind Structure
```jsx
<div className="relative overflow-hidden pt-5 w-full rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 p-4 shadow-elevated">
  {/* Top Accent Bar */}
  <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 dark:bg-amber-600" />
  
  {/* Card Header */}
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-50 font-display">tener que</p>
        <span className="rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/30 dark:border-amber-800/30 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          固定搭配
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">动词短语 · A1</p>
    </div>
    <button className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
      关闭
    </button>
  </div>

  {/* Meaning & Usage Explanation */}
  <div className="mt-3">
    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">必须，不得不</p>
    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded">
      表示客观或主观上有义务做某事，后接动词原形。
    </p>
  </div>

  {/* Examples (Interactive SpanishText) */}
  <div className="mt-4 space-y-2.5">
    <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">例句</p>
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/20 px-3 py-2 border border-zinc-100 dark:border-zinc-800/30">
      <div className="text-sm text-zinc-800 dark:text-zinc-200">
        {/* SpanishText renders words as clickable tokens */}
        <SpanishText text="Tengo que comer ahora." />
      </div>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">我现在必须吃饭了。</p>
    </div>
  </div>
</div>
```

---

## 3. Visual Stack Rendering of Two Stacked Cards

When a user looks up a phrase (Card 1) and then clicks an individual word in its example sentence, the corresponding word lookup card (Card 2) opens and stacks on top of it.
The stack is limited to a maximum depth of **2 cards**.

### 3.1 ASCII Layout Diagram

```text
       ┌────────────────────────────────────────────────────────┐
       │ Phrase Lookup Card (Bottom Card - Pushed Back)         │
       │ Lemma: tener que                          [固定搭配]   │
       │                                                        │
       │   ┌────────────────────────────────────────────────┐   │
       │   │ Word Lookup Card (Top Card - Active)           │   │
       │   │ Lemma: comer                             [动词]  │   │
       │   ├────────────────────────────────────────────────┤   │
       │   │                                                │   │
       │   │  1. 吃，用餐                                   │   │
       │   │                                                │   │
       │   │  [例] Voy a comer.                             │   │
       │   │                                                │   │
       │   │  [ 关闭 ]                    [ 加入我的词库 ]  │   │
       │   └────────────────────────────────────────────────┘   │
       └────────────────────────────────────────────────────────┘
```

### 3.2 JSX Component Stack Layout & Animation Classes

The stack uses absolute positioning to layer the top card above the bottom card. The bottom card is scaled down, pushed upward, blurred slightly, and made non-interactive.

```jsx
export function LookupCardStack({ cards, onCloseCard }) {
  // Limit to max 2 layers
  return (
    <div className="relative w-full min-h-[360px]">
      {cards.map((card, index) => {
        const isBottom = index === 0 && cards.length > 1;
        const isTop = index === cards.length - 1;
        
        return (
          <div
            key={card.id}
            className={`transition-all duration-300 ${
              isBottom
                ? "absolute inset-x-0 bottom-0 z-10 scale-[0.96] -translate-y-3 opacity-40 blur-[0.5px] pointer-events-none select-none"
                : "relative z-20"
            }`}
          >
            <LookupCard
              form={card.lemma}
              onClose={() => onCloseCard(card.id)}
              {...card.props}
            />
          </div>
        );
      })}
    </div>
  );
}
```

### 3.3 Stack Visual Hierarchy Rules

1.  **Z-Index Hierarchy:** Bottom Card has `z-10`; Top Card has `z-20`.
2.  **Opacity & Focus:** Pushed-back card is lowered to `opacity-40` and styled with a minor gaussian blur `blur-[0.5px]` to prevent distracting the user.
3.  **Elevation Shadows:** Top Card uses `shadow-elevated` (representing a high-depth floating shadow), casting a visible layer on top of the bottom card to establish spatial height.

---

## 4. Overlay of Phrase Highlight and Saved Word Underline

When a phrase highlight overlaps with a word that has already been saved by the user (meaning it contains the `.saved-word` underline), the styles overlay harmoniously.

### 4.1 HTML/JSX DOM Structure

```jsx
<span className="phrase-highlight bg-amber-100/50 dark:bg-amber-950/30 border-b border-amber-200/40 dark:border-amber-900/30 rounded px-1 py-0.5 mx-0.5 hover:bg-amber-200/50 dark:hover:bg-amber-900/45 cursor-pointer">
  {/* Clickable Word Token 1: Saved Word */}
  <span 
    className="saved-word cursor-pointer text-zinc-900 dark:text-zinc-50 hover:text-brand-500 dark:hover:text-brand-400"
    onClick={(e) => {
      e.stopPropagation(); // Block phrase lookup, trigger word lookup
      handleWordClick("tengo");
    }}
  >
    Tengo
  </span>
  
  <span className="text-zinc-900 dark:text-zinc-50"> </span>
  
  {/* Clickable Word Token 2: Normal Word */}
  <span 
    className="cursor-pointer text-zinc-900 dark:text-zinc-50 hover:text-brand-500 dark:hover:text-brand-400"
    onClick={(e) => {
      e.stopPropagation();
      handleWordClick("que");
    }}
  >
    que
  </span>
</span>
```

### 4.2 Interaction Mechanics & Click Priority

*   **Visual Overlay:** The outer `span` supplies the soft amber background fill, and the inner `span` supplies the dark gray/light gray underline. They do not collide because one is a background tint and the other is a text underline.
*   **Word Click (Nested Token):** Clicking directly on `Tengo` or `que` triggers the specific word lookup. Crucially, the inner click handler calls `e.stopPropagation()` so the event does not bubble up to the phrase span.
*   **Phrase Click (Outer Container):** Clicking on the whitespace or surrounding padding of the highlight span triggers the collocation lookup for `tener que`.

---

## 5. Design Review Checklist

Prior to handover, this design has been verified against the key constraint files:

- [x] **No Gamification:** Contains zero streak counters, daily targets, XP progress loops, or confetti celebration animations (§1, §6 in `UI-DESIGN-CONSTRAINTS.md`).
- [x] **Warm Editor Style:** Respects the Apple-like publication style with premium off-white backgrounds, dark zinc typography, and standard token spacing heights (§0, §1 in `DESIGN-SYSTEM.md`).
- [x] **Dark Mode Integrity:** Specifically uses `dark:bg-amber-950/30` and `dark:border-amber-900/30` to prevent glaring highlights, and specifies `dark:bg-zinc-900` card backings to preserve proper dark theme layers (§4 in `DESIGN-SYSTEM.md`).
- [x] **No Conflicting Underlines:** Uses a background fill for phrase highlighting, keeping the text underline reserved strictly for saved vocabulary terms.
