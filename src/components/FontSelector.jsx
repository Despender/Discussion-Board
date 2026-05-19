import { useState } from 'react';
import { ALL_FONTS, FONT_SIZES, loadLobbyFont } from '../constants/fonts';

export default function FontSelector({ fontId, fontSize, onFontChange, onSizeChange }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFont = async (font) => {
    setError('');
    if (!font.builtin) {
      setLoading(true);
      try {
        await loadLobbyFont(font);
      } catch {
        setError('Не вдалося завантажити шрифт');
        setLoading(false);
        return;
      }
      setLoading(false);
    }
    onFontChange(font);
  };

  return (
    <div className="font-selector">
      <label className="form-label">Шрифт для текстових блоків</label>
      <div className="list-group font-selector__list">
        {ALL_FONTS.map((font) => (
          <button
            key={font.id}
            type="button"
            className={`list-group-item list-group-item-action${
              fontId === font.id ? ' active' : ''
            }`}
            style={{ fontFamily: font.family }}
            onClick={() => handleFont(font)}
            disabled={loading}
          >
            {font.label}
            {!font.builtin && <span className="badge bg-secondary ms-2">завантажити</span>}
          </button>
        ))}
      </div>

      <label className="form-label mt-3">Розмір шрифту</label>
      <select
        className="form-select"
        value={fontSize}
        onChange={(e) => onSizeChange(Number(e.target.value))}
      >
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}px
          </option>
        ))}
      </select>

      {loading && <p className="text-muted small mt-2 mb-0">Завантаження шрифту…</p>}
      {error && <p className="text-danger small mt-2 mb-0">{error}</p>}
    </div>
  );
}
