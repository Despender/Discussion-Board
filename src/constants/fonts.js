export const UI_FONT_FAMILY = '"Times New Roman", Times, serif';
export const UI_FONT_SIZE_PX = 18;

export const PRIORITY_FONTS = [
  { id: 'times', label: 'Times New Roman', family: '"Times New Roman", Times, serif', builtin: true },
  { id: 'arial-cyr', label: 'Arial Cyr', family: 'Arial, "Helvetica Neue", sans-serif', builtin: true },
];

export const OPTIONAL_FONTS = [
  { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, sans-serif', builtin: true },
  { id: 'courier', label: 'Courier New', family: '"Courier New", monospace', builtin: true },
  {
    id: 'comic-relief',
    label: 'Comic Relief (завантажити)',
    family: '"Comic Relief", cursive',
    builtin: false,
    googleFont: 'Comic+Relief',
  },
];

export const ALL_FONTS = [...PRIORITY_FONTS, ...OPTIONAL_FONTS];

export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

export function loadLobbyFont(font) {
  if (!font?.googleFont || font.builtin) return Promise.resolve();
  const id = `font-${font.id}`;
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleFont}&display=swap`;
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Font load failed'));
    document.head.appendChild(link);
  });
}
