import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { updateCursor } from '../../services/lobbyService';
import { eraserHitsStroke, findTextElementAt, getTextElementBounds } from '../../utils/geometry';
import { getBorderIntersection } from '../../utils/arrowRouting';
import { CANVAS_SIZE, getDrawCanvasBackingSize, getDrawCanvasScale } from '../../constants/canvas';
import { redrawCanvasLayers } from '../../utils/drawStrokes';
import { observeElementResize } from '../../utils/observeResize';
import TextBlock from './TextBlock';
import ArrowLayer from './ArrowLayer';
import './CanvasBoard.css';

function isVisibleToUser(el, viewerId) {
  if (!el?.isPrivate) return true;
  if (el.revealed) return true;
  return el.authorId === viewerId;
}

const GRID_STEP = 80;
const DRAW_CANVAS_BACKING = getDrawCanvasBackingSize();
const DRAW_CANVAS_SCALE = getDrawCanvasScale();

const CanvasBoard = forwardRef(function CanvasBoard(
  {
    lobbyCode,
    userId,
    presence,
    pencilColor,
    arrowColor = '#5865f2',
    pencilWidth,
    drawTool,
    textToolActive,
    canInteract,
    canLink,
    elements,
    selectedElementId,
    onSelectElement,
    onUpdateElement,
    onFinalizeElement,
    onSaveStroke,
    onEraseStrokes,
    onCreateArrow,
    onCreateConsequence,
    onUpdateArrow,
    textHighlightColor,
    remoteSelectionsByElement,
    onReportSelection,
    onViewportChange,
    blockFontFamily = '"Times New Roman", Times, serif',
    blockFontSize = 18,
  },
  ref
) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const drawCanvasRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({
    x: -CANVAS_SIZE / 2 + window.innerWidth / 2,
    y: -CANVAS_SIZE / 2 + window.innerHeight / 2,
  });
  const [scale, setScale] = useState(1);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const drawing = useRef(false);
  const lastPoint = useRef(null);
  const currentStrokePoints = useRef([]);
  const eraserPath = useRef([]);
  const spaceHeld = useRef(false);
  const [draftArrow, setDraftArrow] = useState(null);
  const [dragArrowEnd, setDragArrowEnd] = useState(null);

  const pencilActive = drawTool === 'pencil';
  const eraserActive = drawTool === 'eraser';
  const drawLayerActive = (pencilActive || eraserActive) && canInteract;

  const allElements = elements || {};
  const strokes = Object.values(allElements).filter(
    (e) => e.type === 'stroke' && isVisibleToUser(e, userId)
  );
  const arrows = Object.values(allElements).filter(
    (e) => e.type === 'arrow' && isVisibleToUser(e, userId)
  );
  const textElements = Object.values(allElements).filter(
    (e) => e.type === 'text' && isVisibleToUser(e, userId)
  );

  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - pan.x) / scale,
        y: (clientY - rect.top - pan.y) / scale,
      };
    },
    [pan, scale]
  );

  const screenRectToWorldAnchor = useCallback(
    (domRect) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect || !domRect) return null;
      return {
        x: (domRect.left + domRect.width / 2 - rect.left - pan.x) / scale,
        y: (domRect.top - rect.top - pan.y) / scale - 10,
      };
    },
    [pan, scale]
  );

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return undefined;
    return observeElementResize(vp, ({ width, height }) => {
      setViewportSize({ width, height });
    });
  }, []);

  useEffect(() => {
    onViewportChange?.({ pan, scale, viewportSize });
  }, [pan, scale, viewportSize, onViewportChange]);

  const navigateToWorld = useCallback(
    (worldX, worldY) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPan({
        x: rect.width / 2 - worldX * scale,
        y: rect.height / 2 - worldY * scale,
      });
    },
    [scale]
  );

  useImperativeHandle(ref, () => ({
    getViewportCenter() {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
      return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    getWorldElement() {
      return worldRef.current;
    },
    navigateToWorld,
  }));

  const flushDrawCanvas = useCallback(() => {
    const live =
      pencilActive && currentStrokePoints.current.length > 0
        ? {
            points: currentStrokePoints.current,
            color: pencilColor,
            width: pencilWidth,
          }
        : null;
    const eraserPreview =
      eraserActive && eraserPath.current.length > 1 ? eraserPath.current : null;
    redrawCanvasLayers(
      drawCanvasRef.current,
      strokes,
      scale,
      live,
      eraserPreview,
      pencilWidth * 2,
      DRAW_CANVAS_SCALE
    );
  }, [strokes, scale, pencilColor, pencilWidth, pencilActive, eraserActive]);

  useEffect(() => {
    if (drawing.current) return;
    flushDrawCanvas();
  }, [flushDrawCanvas]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space') spaceHeld.current = true;
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') spaceHeld.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(2.5, Math.max(0.15, scale * delta));

      setPan((p) => ({
        x: mouseX - ((mouseX - p.x) / scale) * newScale,
        y: mouseY - ((mouseY - p.y) / scale) * newScale,
      }));
      setScale(newScale);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scale]);

  const onCanvasPointerDown = (e) => {
    if (!drawLayerActive || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const pt = screenToWorld(e.clientX, e.clientY);

    if (eraserActive) {
      eraserPath.current = [[pt.x, pt.y]];
    } else {
      currentStrokePoints.current = [[pt.x, pt.y]];
    }
    lastPoint.current = pt;
    flushDrawCanvas();
  };

  const onCanvasPointerMove = (e) => {
    if (!drawing.current) return;
    const pt = screenToWorld(e.clientX, e.clientY);

    if (eraserActive) {
      eraserPath.current.push([pt.x, pt.y]);
      lastPoint.current = pt;
      flushDrawCanvas();
      return;
    }

    if (!pencilActive) return;
    currentStrokePoints.current.push([pt.x, pt.y]);
    lastPoint.current = pt;
    flushDrawCanvas();
  };

  const onCanvasPointerUp = async (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (eraserActive) {
      const radius = (pencilWidth * 2) / scale + 8;
      const toDelete = strokes.filter((s) =>
        eraserHitsStroke(eraserPath.current, s, radius)
      );
      eraserPath.current = [];
      lastPoint.current = null;
      currentStrokePoints.current = [];
      flushDrawCanvas();
      if (toDelete.length) {
        await onEraseStrokes(toDelete.map((s) => s.id));
      }
      return;
    }

    if (pencilActive && currentStrokePoints.current.length >= 1) {
      await onSaveStroke({
        points: currentStrokePoints.current,
        color: pencilColor,
        width: pencilWidth,
      });
    }
    currentStrokePoints.current = [];
    lastPoint.current = null;
    flushDrawCanvas();
  };

  const beginLinkDrag = useCallback(
    (opts) => {
      const fromEl = elements[opts.fromId];
      if (!fromEl || !canLink) return;

      let anchorX;
      let anchorY;

      if (opts.hasSelection && opts.selectionRect) {
        const anchor = screenRectToWorldAnchor(opts.selectionRect);
        anchorX = anchor?.x ?? fromEl.x;
        anchorY = anchor?.y ?? fromEl.y;
      } else {
        const pt = screenToWorld(opts.currentClientX, opts.currentClientY);
        const fromB = getTextElementBounds(fromEl);
        const border = getBorderIntersection(fromB, pt.x, pt.y);
        anchorX = border.x;
        anchorY = border.y;
      }

      setDraftArrow({
        fromId: opts.fromId,
        x1: anchorX,
        y1: anchorY,
        x2: anchorX,
        y2: anchorY,
        color: arrowColor,
        isConsequence: opts.isConsequence,
      });

      const move = (ev) => {
        const pt = screenToWorld(ev.clientX, ev.clientY);
        setDraftArrow((d) => (d ? { ...d, x2: pt.x, y2: pt.y } : null));
      };

      const up = async (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const pt = screenToWorld(ev.clientX, ev.clientY);
        const target = findTextElementAt(allElements, pt.x, pt.y);
        setDraftArrow(null);

        if (opts.isConsequence) {
          if (!opts.hasSelection) return;
          await onCreateConsequence({
            sourceElement: fromEl,
            anchorX,
            anchorY,
            endX: pt.x,
            endY: pt.y,
            color: arrowColor,
            selectionHtml: opts.selectionHtml,
            fromDrag: true,
          });
        } else {
          await onCreateArrow({
            fromId: opts.fromId,
            toId: target?.id && target.id !== opts.fromId ? target.id : null,
            toX: pt.x,
            toY: pt.y,
            color: arrowColor,
          });
        }
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [
      elements,
      canLink,
      screenToWorld,
      screenRectToWorldAnchor,
      arrowColor,
      onCreateArrow,
      onCreateConsequence,
    ]
  );

  const handleArrowEndDragStart = useCallback(
    (e, arrowId) => {
      if (!canLink) return;
      e.stopPropagation();
      e.preventDefault();
      onSelectElement(arrowId);

      const move = (ev) => {
        const pt = screenToWorld(ev.clientX, ev.clientY);
        setDragArrowEnd({ arrowId, toX: pt.x, toY: pt.y });
      };

      const up = async (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const pt = screenToWorld(ev.clientX, ev.clientY);
        const target = findTextElementAt(allElements, pt.x, pt.y);
        setDragArrowEnd(null);
        await onUpdateArrow(arrowId, {
          toId: target?.id || null,
          toX: pt.x,
          toY: pt.y,
        });
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [canLink, elements, onUpdateArrow, onSelectElement, screenToWorld]
  );

  const mergedArrows = { ...Object.fromEntries(arrows.map((a) => [a.id, a])) };
  if (dragArrowEnd) {
    const a = mergedArrows[dragArrowEnd.arrowId];
    if (a) {
      mergedArrows[dragArrowEnd.arrowId] = {
        ...a,
        toX: dragArrowEnd.toX,
        toY: dragArrowEnd.toY,
        toId: null,
      };
    }
  }

  const onViewportPointerMove = (e) => {
    if (panning.current) {
      setPan({
        x: panStart.current.panX + (e.clientX - panStart.current.x),
        y: panStart.current.panY + (e.clientY - panStart.current.y),
      });
      return;
    }
    const world = screenToWorld(e.clientX, e.clientY);
    updateCursor(lobbyCode, userId, world.x, world.y);
  };

  const startPan = (e) => {
    const isMiddle = e.button === 1;
    const isSpaceLeft = e.button === 0 && spaceHeld.current;
    const isBackground =
      e.button === 0 &&
      !drawLayerActive &&
      !textToolActive &&
      e.target.classList.contains('canvas-board__surface');
    if (!isMiddle && !isSpaceLeft && !isBackground) return;
    e.preventDefault();
    panning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const endPan = () => {
    panning.current = false;
  };

  const onSurfaceClick = (e) => {
    if (textToolActive && canInteract && e.target.classList.contains('canvas-board__surface')) {
      e.stopPropagation();
      onSelectElement(null);
    }
    if (!textToolActive && !drawLayerActive) {
      onSelectElement(null);
    }
  };

  const gridSize = GRID_STEP / scale;
  const worldTransform = { transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` };
  const sortedTexts = textElements.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  return (
    <div
      className={`canvas-board${pencilActive ? ' canvas-board--pencil' : ''}${eraserActive ? ' canvas-board--eraser' : ''}${textToolActive ? ' canvas-board--text' : ''}`}
      ref={viewportRef}
      onPointerMove={onViewportPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      onPointerDown={startPan}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={worldRef} className="canvas-board__world" style={worldTransform}>
        <div
          className="canvas-board__surface"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
          onPointerDown={onSurfaceClick}
        >
          <div
            className="canvas-board__grid"
            style={{ backgroundSize: `${gridSize}px ${gridSize}px` }}
          />
          <canvas
            ref={drawCanvasRef}
            className="canvas-board__draw-layer"
            width={DRAW_CANVAS_BACKING}
            height={DRAW_CANVAS_BACKING}
            style={{ pointerEvents: drawLayerActive ? 'auto' : 'none' }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={onCanvasPointerUp}
          />
          <ArrowLayer
            arrows={mergedArrows}
            elements={elements}
            selectedElementId={selectedElementId}
            onSelectElement={onSelectElement}
            draftArrow={
              draftArrow
                ? {
                    fromId: draftArrow.fromId,
                    x2: draftArrow.x2,
                    y2: draftArrow.y2,
                    color: draftArrow.color,
                  }
                : null
            }
            onArrowEndDragStart={canLink ? handleArrowEndDragStart : null}
          />
          <div
            className="canvas-board__content"
            style={{
              '--block-font-family': blockFontFamily,
              '--block-font-size': `${blockFontSize}px`,
            }}
          >
            {sortedTexts.map((el) => (
              <TextBlock
                key={el.id}
                element={el}
                selected={selectedElementId === el.id}
                canEdit={canInteract}
                canLink={canLink}
                highlightColor={textHighlightColor}
                onSelect={() => onSelectElement(el.id)}
                onUpdate={(patch) => onUpdateElement(el.id, patch)}
                onFinalize={() => onFinalizeElement(el.id)}
                onStartLinkDrag={beginLinkDrag}
                remoteSelection={remoteSelectionsByElement?.[el.id]}
                onReportSelection={onReportSelection}
                reportSelectionEnabled={canInteract}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default CanvasBoard;
