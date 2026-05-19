import { useMemo } from 'react';
import FloatingPanel from '../lobby/FloatingPanel';
import { getDefaultPanelPositions } from '../../services/userStorage';
import './BoardMinimap.css';

const CANVAS_SIZE = 16000;

function MinimapContent({ elements, viewportPan, viewportScale, viewportSize, onNavigate }) {
  const markers = useMemo(() => {
    return Object.values(elements || {})
      .filter((el) => el.type === 'text')
      .map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        w: el.width || 200,
        h: el.height || 60,
      }));
  }, [elements]);

  const miniScale = 120 / CANVAS_SIZE;
  const viewW = (viewportSize?.width || 800) / (viewportScale || 1);
  const viewH = (viewportSize?.height || 600) / (viewportScale || 1);
  const viewX = (-(viewportPan?.x || 0)) / (viewportScale || 1);
  const viewY = (-(viewportPan?.y || 0)) / (viewportScale || 1);

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    onNavigate?.(rx * CANVAS_SIZE, ry * CANVAS_SIZE);
  };

  return (
    <div
      className="board-minimap__surface floating-panel__no-drag"
      onClick={handleClick}
      role="presentation"
      title="Клік — перейти до області"
    >
      {markers.map((m) => (
        <div
          key={m.id}
          className="board-minimap__dot"
          style={{
            left: `${m.x * miniScale}px`,
            top: `${m.y * miniScale}px`,
            width: `${Math.max(2, m.w * miniScale)}px`,
            height: `${Math.max(2, m.h * miniScale)}px`,
          }}
        />
      ))}
      <div
        className="board-minimap__viewport"
        style={{
          left: `${viewX * miniScale}px`,
          top: `${viewY * miniScale}px`,
          width: `${viewW * miniScale}px`,
          height: `${viewH * miniScale}px`,
        }}
      />
    </div>
  );
}

export default function BoardMinimap(props) {
  const defaults = getDefaultPanelPositions();

  return (
    <FloatingPanel
      panelId="minimap"
      title="Міні-карта"
      defaultPosition={defaults.minimap}
      className="board-minimap-panel"
      bodyClassName="board-minimap-panel__body"
      zIndex={200}
    >
      <MinimapContent {...props} />
    </FloatingPanel>
  );
}
