import { useEffect, useState } from 'react';
import './RemoteSelectionHighlight.css';

function rectsForTextRange(editorEl, start, end) {
  if (!editorEl || start == null || end == null || start >= end) return [];

  const rects = [];
  const walker = document.createTreeWalker(editorEl, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let node;

  while ((node = walker.nextNode())) {
    const len = node.textContent.length;
    const nodeStart = pos;
    const nodeEnd = pos + len;
    pos = nodeEnd;

    const overlapStart = Math.max(start, nodeStart);
    const overlapEnd = Math.min(end, nodeEnd);
    if (overlapStart >= overlapEnd) continue;

    const range = document.createRange();
    range.setStart(node, overlapStart - nodeStart);
    range.setEnd(node, overlapEnd - nodeStart);
    Array.from(range.getClientRects()).forEach((rect) => {
      if (rect.width > 0.5 && rect.height > 0.5) rects.push(rect);
    });
  }
  return rects;
}

export function getSelectionOffsets(editorEl) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !editorEl?.contains(sel.anchorNode)) {
    return null;
  }
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(editorEl);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { start, end: start + range.toString().length };
}

export default function RemoteSelectionHighlight({
  editorRef,
  blockRef,
  remoteSelection,
  onReportSelection,
  elementId,
  reportingEnabled,
}) {
  const [localRects, setLocalRects] = useState([]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !reportingEnabled) return undefined;

    let timer;
    const report = () => {
      const offsets = getSelectionOffsets(editor);
      onReportSelection?.(
        offsets
          ? { elementId, start: offsets.start, end: offsets.end }
          : { elementId, start: null, end: null }
      );
    };

    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(report, 120);
    };

    document.addEventListener('selectionchange', onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onChange);
      onReportSelection?.({ elementId, start: null, end: null });
    };
  }, [editorRef, elementId, onReportSelection, reportingEnabled]);

  useEffect(() => {
    const editor = editorRef.current;
    const block = blockRef.current;
    if (!editor || !block || !remoteSelection) {
      setLocalRects([]);
      return undefined;
    }

    const { start, end } = remoteSelection;
    if (start == null || end == null || start >= end) {
      setLocalRects([]);
      return undefined;
    }

    const update = () => {
      const blockRect = block.getBoundingClientRect();
      setLocalRects(
        rectsForTextRange(editor, start, end).map((r) => ({
          left: r.left - blockRect.left,
          top: r.top - blockRect.top,
          width: r.width,
          height: r.height,
        }))
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(editor);
    window.addEventListener('scroll', update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
    };
  }, [editorRef, blockRef, remoteSelection]);

  if (!localRects.length) return null;

  const color = remoteSelection?.color || 'rgba(88, 166, 255, 0.35)';

  return (
    <div className="remote-selection-highlight" aria-hidden>
      {localRects.map((r, i) => (
        <div
          key={i}
          className="remote-selection-highlight__rect"
          style={{
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
            backgroundColor: color,
          }}
        />
      ))}
      {remoteSelection?.nickname && localRects[0] && (
        <span
          className="remote-selection-highlight__label"
          style={{
            left: localRects[0].left,
            top: localRects[0].top - 18,
            borderColor: color,
          }}
        >
          {remoteSelection.nickname}
        </span>
      )}
    </div>
  );
}
