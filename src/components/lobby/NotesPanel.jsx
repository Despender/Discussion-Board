import { useEffect, useState } from 'react';
import FloatingPanel from './FloatingPanel';
import { getDefaultPanelPositions, loadNotes, saveNotes } from '../../services/userStorage';
import './NotesPanel.css';

export default function NotesPanel({ lobbyCode }) {
  const [text, setText] = useState(() => loadNotes(lobbyCode));
  const defaults = getDefaultPanelPositions();

  useEffect(() => {
    saveNotes(lobbyCode, text);
  }, [lobbyCode, text]);

  return (
    <FloatingPanel
      panelId={`notes_${lobbyCode}`}
      title=""
      minimalHeader
      defaultPosition={defaults.notes}
      defaultCollapsed
      className="notes-panel"
      bodyClassName="notes-panel__body-wrap"
      zIndex={210}
    >
      <textarea
        className="notes-panel__body form-control"
        placeholder="Тільки ви бачите ці нотатки…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </FloatingPanel>
  );
}
