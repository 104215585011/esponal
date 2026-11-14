// Timestamp: 2026-11-15 06:55
import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";

export type AppIconName =
  | "search"
  | "headphones"
  | "mic"
  | "grammar"
  | "phonics"
  | "book"
  | "shelf"
  | "play"
  | "download"
  | "settings"
  | "credits"
  | "update"
  | "chevron"
  | "close"
  | "speak";

const ICON_MAP = {
  search: { ios: "magnifyingglass", android: "search", web: "search" },
  headphones: { ios: "headphones", android: "headphones", web: "headphones" },
  mic: { ios: "mic.fill", android: "mic", web: "mic" },
  grammar: { ios: "puzzlepiece.extension.fill", android: "extension", web: "extension" },
  phonics: { ios: "textformat.abc", android: "spellcheck", web: "spellcheck" },
  book: { ios: "book.fill", android: "menu_book", web: "menu_book" },
  shelf: { ios: "books.vertical.fill", android: "library_books", web: "library_books" },
  play: { ios: "play.fill", android: "play_arrow", web: "play_arrow" },
  download: { ios: "arrow.down.circle.fill", android: "download", web: "download" },
  settings: { ios: "gearshape.fill", android: "settings", web: "settings" },
  credits: { ios: "wallet.bifold.fill", android: "account_balance_wallet", web: "account_balance_wallet" },
  update: { ios: "arrow.triangle.2.circlepath", android: "system_update", web: "system_update" },
  chevron: { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  close: { ios: "xmark", android: "close", web: "close" },
  speak: { ios: "speaker.wave.2.fill", android: "volume_up", web: "volume_up" }
} as const;

export function AppIcon({
  name,
  size = 18,
  color
}: {
  name: AppIconName;
  size?: number;
  color: ColorValue;
}) {
  return <SymbolView name={ICON_MAP[name]} size={size} tintColor={color} />;
}
