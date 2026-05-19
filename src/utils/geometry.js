export function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export function strokeHitTest(points, x, y, radius) {
  if (!points || points.length < 2) return false;
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (distPointToSegment(x, y, x1, y1, x2, y2) <= radius) return true;
  }
  return false;
}

export function eraserHitsStroke(eraserPoints, stroke, radius) {
  if (!eraserPoints?.length || !stroke?.points?.length) return false;
  return eraserPoints.some(([ex, ey]) =>
    stroke.points.some(([sx, sy]) => Math.hypot(ex - sx, ey - sy) <= radius)
  ) || eraserPoints.some(([ex, ey]) => strokeHitTest(stroke.points, ex, ey, radius));
}

/** Межі редактора блоку (element.x/y/width/height), без consequenceOffset і UI-надбудов. */
export function getTextElementBounds(el) {
  const width = el.width ?? 300;
  const height = Math.max(el.height ?? 60, 20);
  const x = el.x;
  const y = el.y;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

export function findTextElementAt(elements, x, y) {
  const texts = Object.values(elements).filter((e) => e.type === 'text');
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const el = texts[i];
    const b = getTextElementBounds(el);
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return el;
  }
  return null;
}

export function getAnchorPoint(el, side = 'center') {
  const b = getTextElementBounds(el);
  switch (side) {
    case 'top':
      return { x: b.centerX, y: b.y };
    case 'bottom':
      return { x: b.centerX, y: b.y + b.height };
    case 'left':
      return { x: b.x, y: b.centerY };
    case 'right':
      return { x: b.x + b.width, y: b.centerY };
    default:
      return { x: b.centerX, y: b.centerY };
  }
}
