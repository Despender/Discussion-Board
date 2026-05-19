import { getTextElementBounds } from './geometry';

/**
 * Точка на межі прямокутника, куди виходить промінь від центру до цілі.
 * Для вертикальних/горизонтальних з'єднань використовує min-масштаб (коректна грань).
 */
export function getBorderIntersection(bounds, targetX, targetY) {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return { x: cx, y: bounds.y };
  }

  const hw = bounds.width / 2;
  const hh = bounds.height / 2;
  const scaleX = Math.abs(dx) > 1e-9 ? hw / Math.abs(dx) : Infinity;
  const scaleY = Math.abs(dy) > 1e-9 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

/** Пряма лінія між двома точками (від грані блоку до грані/точки). */
export function buildStraightPath(x1, y1, x2, y2) {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
  ];
}

/** @deprecated використовуйте buildStraightPath */
export function buildOrthogonalPath(x1, y1, x2, y2) {
  return buildStraightPath(x1, y1, x2, y2);
}

export function pathToSvgPoints(path) {
  return path.map((p) => `${p.x},${p.y}`).join(' ');
}

export function lastSegmentAngle(path) {
  if (path.length < 2) return 0;
  const a = path[path.length - 2];
  const b = path[path.length - 1];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function resolveBlockToBlock(fromEl, toEl) {
  const fromB = getTextElementBounds(fromEl);
  const toB = getTextElementBounds(toEl);
  const start = getBorderIntersection(fromB, toB.centerX, toB.centerY);
  const end = getBorderIntersection(toB, start.x, start.y);
  const path = buildStraightPath(start.x, start.y, end.x, end.y);
  return { start, end, path, fromId: fromEl.id, toId: toEl.id };
}

export function resolveArrowConnection(fromEl, toEl, elements, freePoint = null) {
  if (!fromEl) return null;

  if (toEl && toEl.id !== fromEl.id) {
    return resolveBlockToBlock(fromEl, toEl);
  }

  if (freePoint) {
    const fromB = getTextElementBounds(fromEl);
    const start = getBorderIntersection(fromB, freePoint.x, freePoint.y);
    const end = { x: freePoint.x, y: freePoint.y };
    const path = buildStraightPath(start.x, start.y, end.x, end.y);
    return { start, end, path, fromId: fromEl.id, toId: null };
  }

  return null;
}

export function resolveArrowFromIds(arrow, elements) {
  const fromEl = arrow.fromId ? elements[arrow.fromId] : null;
  const toEl = arrow.toId ? elements[arrow.toId] : null;

  if (fromEl && toEl) {
    return resolveBlockToBlock(fromEl, toEl);
  }

  if (fromEl && (arrow.toX != null || arrow.toY != null)) {
    return resolveArrowConnection(fromEl, null, elements, {
      x: arrow.toX,
      y: arrow.toY,
    });
  }

  if (arrow.fromX != null && arrow.toX != null) {
    const path = buildStraightPath(arrow.fromX, arrow.fromY, arrow.toX, arrow.toY);
    return {
      start: { x: arrow.fromX, y: arrow.fromY },
      end: { x: arrow.toX, y: arrow.toY },
      path,
    };
  }

  return null;
}

export function getObstacleBounds(elements, excludeIds = []) {
  return Object.values(elements || {})
    .filter((e) => e.type === 'text' && !excludeIds.includes(e.id))
    .map((e) => getTextElementBounds(e));
}
