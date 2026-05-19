import { resolveArrowFromIds, pathToSvgPoints, lastSegmentAngle } from '../../utils/arrowRouting';
import './ArrowLayer.css';

function ArrowHead({ x, y, angle, color }) {
  const size = 10;
  const x1 = x - size * Math.cos(angle - Math.PI / 6);
  const y1 = y - size * Math.sin(angle - Math.PI / 6);
  const x2 = x - size * Math.cos(angle + Math.PI / 6);
  const y2 = y - size * Math.sin(angle + Math.PI / 6);
  return <polygon points={`${x},${y} ${x1},${y1} ${x2},${y2}`} fill={color} />;
}

function RoutedArrow({
  path,
  color,
  dashed,
  arrowId,
  selected,
  onSelect,
  onEndPointerDown,
}) {
  if (!path || path.length < 2) return null;
  const angle = lastSegmentAngle(path);
  const end = path[path.length - 1];
  const points = pathToSvgPoints(path);
  const strokeColor = selected ? '#fee75c' : color;

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect?.(arrowId);
  };

  return (
    <g className={`arrow-layer__arrow${selected ? ' is-selected' : ''}`}>
      <polyline
        className="arrow-layer__hit"
        points={points}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        strokeLinecap="round"
        strokeLinejoin="round"
        onPointerDown={handleSelect}
      />
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 3.5 : 2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? '6 4' : undefined}
        pointerEvents="none"
      />
      {!dashed && <ArrowHead x={end.x} y={end.y} angle={angle} color={strokeColor} />}
      {!dashed && selected && onEndPointerDown && (
        <circle
          cx={end.x}
          cy={end.y}
          r={12}
          className="arrow-layer__handle"
          onPointerDown={(e) => {
            handleSelect(e);
            onEndPointerDown(e, arrowId, end);
          }}
        />
      )}
    </g>
  );
}

export default function ArrowLayer({
  arrows,
  elements,
  draftArrow,
  selectedElementId,
  onSelectElement,
  onArrowEndDragStart,
}) {
  const list = Object.values(arrows || {}).filter((a) => a.type === 'arrow');

  let draftPath = null;
  if (draftArrow?.fromId && elements[draftArrow.fromId]) {
    const resolved = resolveArrowFromIds(
      {
        fromId: draftArrow.fromId,
        toId: draftArrow.toId,
        toX: draftArrow.x2,
        toY: draftArrow.y2,
      },
      elements
    );
    draftPath = resolved?.path;
  } else if (draftArrow?.x1 != null) {
    const fromEl = draftArrow.fromId ? elements[draftArrow.fromId] : null;
    if (fromEl) {
      const resolved = resolveArrowFromIds(
        {
          fromId: draftArrow.fromId,
          toX: draftArrow.x2,
          toY: draftArrow.y2,
        },
        elements
      );
      draftPath = resolved?.path;
    }
  }

  return (
    <svg className="arrow-layer" xmlns="http://www.w3.org/2000/svg">
      {list.map((arrow) => {
        const resolved = resolveArrowFromIds(arrow, elements);
        if (!resolved?.path) return null;
        const isPrivate = arrow.isPrivate && !arrow.revealed;
        return (
          <RoutedArrow
            key={arrow.id}
            arrowId={arrow.id}
            path={resolved.path}
            color={isPrivate ? '#ed4245' : arrow.color || '#5865f2'}
            dashed={isPrivate}
            selected={selectedElementId === arrow.id}
            onSelect={onSelectElement}
            onEndPointerDown={onArrowEndDragStart}
          />
        );
      })}
      {draftPath && (
        <RoutedArrow path={draftPath} color={draftArrow?.color || '#5865f2'} dashed />
      )}
    </svg>
  );
}
