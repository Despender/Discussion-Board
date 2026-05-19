import { useCallback, useEffect, useRef, useState } from 'react';
import TextFormatBar from './TextFormatBar';
import RemoteSelectionHighlight from './RemoteSelectionHighlight';
import { observeElementResize } from '../../utils/observeResize';
import './TextBlock.css';

function getSelectionInEditor(editorEl) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !editorEl?.contains(sel.anchorNode)) {
    return { hasSelection: false, html: null, rect: null };
  }
  const range = sel.getRangeAt(0);
  const div = document.createElement('div');
  div.appendChild(range.cloneContents());
  const html = div.innerHTML.trim() || sel.toString().trim();
  return {
    hasSelection: Boolean(html),
    html: html || null,
    rect: range.getBoundingClientRect(),
  };
}

export default function TextBlock({
  element,
  selected,
  canEdit,
  canLink,
  highlightColor,
  onSelect,
  onUpdate,
  onFinalize,
  onStartLinkDrag,
  remoteSelection,
  onReportSelection,
  reportSelectionEnabled,
}) {
  const blockRef = useRef(null);
  const editorRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [dragPos, setDragPos] = useState(null);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const linkPointer = useRef(null);

  const isRoleBlock = element.role === 'premise' || element.role === 'conclusion';
  const canUseBlock = isRoleBlock ? canLink : canEdit;
  const isEditing =
    canUseBlock &&
    (isRoleBlock ? selected || !element.finalized : !element.finalized || selected);
  const showBox = element.finalized && hovered;

  useEffect(() => {
    if (!editorRef.current || editorRef.current.innerHTML === element.html) return;
    editorRef.current.innerHTML = element.html || '';
  }, [element.id, element.html, element.finalized]);

  useEffect(() => {
    const syncSelection = () => {
      setHasTextSelection(getSelectionInEditor(editorRef.current).hasSelection);
    };
    document.addEventListener('selectionchange', syncSelection);
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, [element.id]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return undefined;
    return observeElementResize(el, () => {
      const h = el.offsetHeight;
      if (h > 20 && Math.abs(h - (element.height || 0)) > 6) {
        onUpdate({ height: h });
      }
    });
  }, [element.id, element.height, onUpdate]);

  const saveHtml = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    if (html !== element.html) onUpdate({ html });
  }, [element.html, onUpdate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !element.finalized) {
      e.preventDefault();
    }
  };

  const startDrag = (e) => {
    if (!canUseBlock || e.button !== 0) return;
    e.stopPropagation();
    const start = {
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
    };
    const move = (ev) => {
      setDragPos({
        x: start.origX + (ev.clientX - start.startX),
        y: start.origY + (ev.clientY - start.startY),
      });
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onUpdate({
        x: start.origX + (ev.clientX - start.startX),
        y: start.origY + (ev.clientY - start.startY),
      });
      setDragPos(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const tryStartLinkDrag = (e, { isConsequence, requireSelection } = {}) => {
    if (!canLink || e.button !== 0) return;

    const { hasSelection, html: selectionHtml, rect: selectionRect } =
      getSelectionInEditor(editorRef.current);

    if (requireSelection && !hasSelection) return;
    if (isConsequence && !hasSelection) return;

    e.stopPropagation();
    if (!isConsequence) e.preventDefault();

    linkPointer.current = {
      x: e.clientX,
      y: e.clientY,
      hasSelection,
      isConsequence: Boolean(isConsequence),
      selectionHtml,
      selectionRect,
    };

    const move = (ev) => {
      if (!linkPointer.current || linkPointer.current.started) return;
      const d = Math.hypot(ev.clientX - linkPointer.current.x, ev.clientY - linkPointer.current.y);
      if (d < 10) return;
      linkPointer.current.started = true;

      onStartLinkDrag?.({
        fromId: element.id,
        clientX: linkPointer.current.x,
        clientY: linkPointer.current.y,
        currentClientX: ev.clientX,
        currentClientY: ev.clientY,
        hasSelection: linkPointer.current.hasSelection,
        isConsequence: linkPointer.current.isConsequence,
        selectionHtml: linkPointer.current.selectionHtml,
        selectionRect: linkPointer.current.selectionRect,
        editorRect: editorRef.current?.getBoundingClientRect(),
      });
    };

    const up = () => {
      linkPointer.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const posX = dragPos?.x ?? element.x;
  const posY = dragPos?.y ?? element.y;
  const offsetTop = element.consequenceOffset || 0;

  const applyFormat = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    saveHtml();
  };

  const applyAlign = (align) => {
    const cmd =
      align === 'center'
        ? 'justifyCenter'
        : align === 'right'
          ? 'justifyRight'
          : align === 'justify'
            ? 'justifyFull'
            : 'justifyLeft';
    applyFormat(cmd);
    onUpdate({ align });
  };

  const applyTextColor = (color) => {
    applyFormat('foreColor', color);
  };

  const showArrowHandle =
    canLink &&
    !element.role &&
    !element.compact &&
    element.finalized &&
    selected &&
    !hasTextSelection;

  return (
    <div
      ref={blockRef}
      className={`text-block${selected ? ' is-selected' : ''}${element.finalized ? ' is-finalized' : ''}${showBox ? ' is-hovered' : ''}${element.compact ? ' text-block--compact' : ''}${element.isPrivate && !element.revealed ? ' text-block--private' : ''}`}
      style={{
        left: posX,
        top: posY + offsetTop,
        width: element.width,
        marginTop: -offsetTop,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {isEditing && !element.compact && (
        <TextFormatBar
          align={element.align}
          highlightColor={highlightColor}
          onAlign={applyAlign}
          onBold={() => applyFormat('bold')}
          onItalic={() => applyFormat('italic')}
          onColor={applyTextColor}
          onFinalize={() => {
            saveHtml();
            onFinalize();
          }}
          showFinalize={!element.finalized}
        />
      )}

      {canUseBlock && (
        <div className="text-block__drag-handle" onPointerDown={startDrag} title="Перетягнути">
          ⋮⋮
        </div>
      )}

      {showArrowHandle && (
        <button
          type="button"
          className="text-block__arrow-handle"
          title="Потягніть для стрілки"
          onPointerDown={(e) => tryStartLinkDrag(e, { isConsequence: false })}
        >
          ⟷
        </button>
      )}

      <RemoteSelectionHighlight
        editorRef={editorRef}
        blockRef={blockRef}
        elementId={element.id}
        remoteSelection={remoteSelection}
        onReportSelection={onReportSelection}
        reportingEnabled={reportSelectionEnabled && selected}
      />

      <div
        ref={editorRef}
        className={`text-block__editor text-align-${element.align || 'left'}`}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onInput={saveHtml}
        onBlur={saveHtml}
        onKeyDown={handleKeyDown}
        onPointerDown={(e) => {
          if (!canLink || e.button !== 0) return;
          if (!e.shiftKey) return;
          const { hasSelection } = getSelectionInEditor(editorRef.current);
          if (!hasSelection) return;
          tryStartLinkDrag(e, { isConsequence: true, requireSelection: true });
        }}
        data-placeholder={element.compact ? '' : 'Введіть текст…'}
      />
    </div>
  );
}
