import { useCallback, useMemo, useRef, useState } from 'react';
import './ColorPicker.css';

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

const PRESETS = [
  '#5865f2', '#57f287', '#fee75c', '#eb459e', '#ed4245',
  '#ffffff', '#99aab5', '#2c2f33', '#23272a',
];

export default function ColorPicker({ value, onChange }) {
  const [hue, setHue] = useState(235);
  const [sat, setSat] = useState(0.72);
  const [val, setVal] = useState(0.95);
  const svRef = useRef(null);

  const currentHex = useMemo(() => {
    const { r, g, b } = hsvToRgb(hue, sat, val);
    return rgbToHex(r, g, b);
  }, [hue, sat, val]);

  const applyHex = useCallback(
    (hex) => {
      onChange(hex);
      const rgb = hexToRgb(hex);
      if (!rgb) return;
      const r = rgb.r / 255;
      const g = rgb.g / 255;
      const b = rgb.b / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      setHue(h);
      setSat(max === 0 ? 0 : d / max);
      setVal(max);
    },
    [onChange]
  );

  const handleSvPointer = useCallback(
    (e) => {
      const el = svRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
      const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height);
      const s = x / rect.width;
      const v = 1 - y / rect.height;
      setSat(s);
      setVal(v);
      const { r, g, b } = hsvToRgb(hue, s, v);
      onChange(rgbToHex(r, g, b));
    },
    [hue, onChange]
  );

  const startSvDrag = (e) => {
    const el = svRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    handleSvPointer(e);
    const move = (ev) => handleSvPointer(ev);
    const up = (ev) => {
      el.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const cursorStyle = {
    left: `${sat * 100}%`,
    top: `${(1 - val) * 100}%`,
    backgroundColor: currentHex,
  };

  const svBackground = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`;

  return (
    <div className="color-picker">
      <div
        className="color-picker__sv"
        ref={svRef}
        style={{ background: svBackground }}
        onPointerDown={startSvDrag}
        role="presentation"
      >
        <span className="color-picker__cursor" style={cursorStyle} />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        className="color-picker__hue form-range"
        onChange={(e) => {
          const h = Number(e.target.value);
          setHue(h);
          const { r, g, b } = hsvToRgb(h, sat, val);
          onChange(rgbToHex(r, g, b));
        }}
      />

      <div className="color-picker__hex input-group input-group-sm">
        <span className="input-group-text">#</span>
        <input
          type="text"
          className="form-control"
          value={value.replace('#', '')}
          maxLength={6}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6);
            if (raw.length === 6) applyHex(`#${raw}`);
          }}
        />
        <span
          className="input-group-text color-picker__swatch"
          style={{ backgroundColor: value }}
        />
      </div>

      <div className="color-picker__presets">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-picker__preset${value === c ? ' is-active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => applyHex(c)}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}
