// UI theme switching between the traditional chat interface ("classic")
// and the Project Hail Mary-inspired audio-analysis look ("translator").

export type UITheme = "translator" | "classic";

const STORAGE_KEY = "rocky-ui-theme";

export function loadTheme(): UITheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "classic" || stored === "translator") return stored;
  } catch {
    // localStorage unavailable (e.g. private mode) — fall through
  }
  return "translator";
}

export function saveTheme(theme: UITheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-fatal — theme just won't persist
  }
}
