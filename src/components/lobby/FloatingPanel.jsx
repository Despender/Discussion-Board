import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPanelLayout, savePanelLayout } from '../../services/userStorage';
import './FloatingPanel.css';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function FloatingPanel({
  panelId,
  title,
  defaultPosition,
  defaultCollapsed = false,
  className = '',
  bodyClassName = '',
  zIndex = 180,
  minimalHeader = false,
  children,
}) {
  const defaults = { position: defaultPosition, collapsed: defaultCollapsed };
  const [collapsed, setCollapsed] = useState(() => {
    if (!panelId) return defaultCollapsed;
    return loadPanelLayout(panelId, defaults).collapsed;
  });
  const [pos, setPos] = useState(() => {
    if (!panelId) return defaultPosition;
    return loadPanelLayout(panelId, defaults).position;
  });
  const dragRef = useRef(null);

  useEffect(() => {
    if (!panelId) return;
    savePanelLayout(panelId, { position: pos, collapsed });
  }, [panelId, pos, collapsed]);

  const startDrag = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, input, textarea, select, a, label, .floating-panel__no-drag')) {
        return;
      }
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pos.x,
        origY: pos.y,
        width: e.currentTarget.closest('.floating-panel')?.offsetWidth || 280,
        height: e.currentTarget.closest('.floating-panel')?.offsetHeight || 120,
      };

      const move = (ev) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        const maxX = Math.max(8, window.innerWidth - dragRef.current.width - 8);
        const maxY = Math.max(8, window.innerHeight - dragRef.current.height - 8);
        setPos({
          x: clamp(dragRef.current.origX + dx, 8, maxX),
          y: clamp(dragRef.current.origY + dy, 8, maxY),
        });
      };

      const up = () => {
        dragRef.current = null;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [pos]
  );

  const toggleCollapsed = (e) => {
    e.stopPropagation();
    setCollapsed((v) => !v);
  };

  return (
    <div
      className={`floating-panel${collapsed ? ' is-collapsed' : ''}${minimalHeader ? ' floating-panel--minimal' : ''} ${className}`.trim()}
      style={{ left: pos.x, top: pos.y, zIndex }}
    >
      <div
        className="floating-panel__header"
        onPointerDown={startDrag}
        role="presentation"
      >
        {!minimalHeader && title ? (
          <span className="floating-panel__title">{title}</span>
        ) : (
          <span className="floating-panel__title" aria-hidden />
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary floating-panel__toggle"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? 'Розгорнути нотатки' : 'Згорнути нотатки'}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>
      {!collapsed && (
        <div className={`floating-panel__body ${bodyClassName}`.trim()}>{children}</div>
      )}
    </div>
  );
}
