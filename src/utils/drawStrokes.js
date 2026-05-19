export function drawStrokeOnCtx(ctx, stroke, scale = 1) {
  if (!stroke?.points?.length) return;
  ctx.save();
  ctx.strokeStyle = stroke.color || '#ffffff';
  ctx.lineWidth = (stroke.width || 3) / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const [fx, fy] = stroke.points[0];
  ctx.moveTo(fx, fy);
  for (let i = 1; i < stroke.points.length; i += 1) {
    const [x, y] = stroke.points[i];
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawEraserPathOnCtx(ctx, points, width, scale = 1) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,1)';
  ctx.lineWidth = width / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.stroke();
  ctx.restore();
}

export function redrawCanvasLayers(
  canvas,
  strokes,
  scale,
  liveStroke = null,
  eraserPoints = null,
  eraserWidth = 8,
  drawScale = 1
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (drawScale !== 1) {
    ctx.scale(drawScale, drawScale);
  }
  strokes.forEach((s) => drawStrokeOnCtx(ctx, s, scale));
  if (liveStroke?.points?.length) {
    drawStrokeOnCtx(ctx, liveStroke, scale);
  }
  if (eraserPoints?.length) {
    drawEraserPathOnCtx(ctx, eraserPoints, eraserWidth, scale);
  }
}

/** @deprecated use redrawCanvasLayers */
export function redrawAllStrokes(canvas, strokes, scale = 1) {
  redrawCanvasLayers(canvas, strokes, scale);
}
