import { useId } from 'react';
import './ArrowPreview.css';

export default function ArrowPreview({ color = '#5865f2', label = 'Попередній перегляд стрілки' }) {
  const markerId = useId().replace(/:/g, '');

  return (
    <div className="arrow-preview" aria-hidden={!label}>
      <svg className="arrow-preview__svg" viewBox="0 0 140 36" width="140" height="36">
        <defs>
          <marker
            id={markerId}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill={color} />
          </marker>
        </defs>
        <line
          x1="8"
          y1="18"
          x2="118"
          y2="18"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          markerEnd={`url(#${markerId})`}
        />
      </svg>
      {label ? <p className="arrow-preview__label mb-0">{label}</p> : null}
    </div>
  );
}
