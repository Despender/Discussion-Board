import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import ColorPicker from '../ColorPicker';
import {
  setMemberCanEdit,
  setCurrentTurn,
  setTurnsEnabled,
  transferHost,
} from '../../services/lobbyService';
import FloatingPanel from './FloatingPanel';
import { getDefaultPanelPositions } from '../../services/userStorage';
import './LobbyToolbar.css';

export default function LobbyToolbar({
  lobby,
  lobbyCode,
  userId,
  members,
  presence,
  profile,
  onProfileChange,
  onNotify,
  drawTool,
  onSetDrawTool,
  pencilColor,
  pencilWidth,
  onPencilColor,
  onPencilWidth,
  textToolActive,
  onToggleTextTool,
  onAddText,
  onDeleteSelected,
  canDeleteSelected,
  onShowTemplates,
  onUndo,
  canUndo,
  onExportBoard,
  canExportBoard,
}) {
  const [showPencilMenu, setShowPencilMenu] = useState(false);
  const [editNickname, setEditNickname] = useState(false);
  const [editColor, setEditColor] = useState(false);
  const [nickDraft, setNickDraft] = useState(profile.nickname);

  const isHost = lobby?.hostId === userId;
  const myMember = members[userId];
  const canEdit = myMember?.canEdit !== false;
  const isMyTurn =
    !lobby?.turnsEnabled ||
    !lobby?.globalTurnLocked ||
    lobby?.currentTurnUserId === userId;
  const canInteract = canEdit && isMyTurn;

  const toggleDrawTool = (tool) => {
    onSetDrawTool(drawTool === tool ? 'none' : tool);
  };

  const onlineIds = new Set(Object.keys(presence || {}));

  const memberList = Object.entries(members || {}).map(([id, m]) => ({
    id,
    ...m,
    isOnline: onlineIds.has(id),
  }));

  const applyNickname = () => {
    const next = nickDraft.trim();
    if (next.length < 2) return;
    if (next !== profile.nickname) {
      onProfileChange({ nickname: next });
      onNotify(`${profile.nickname} змінив(ла) нікнейм на «${next}»`);
    }
    setEditNickname(false);
  };

  const applyColor = (color) => {
    if (color !== profile.color) {
      onProfileChange({ color });
      onNotify(`${profile.nickname} змінив(ла) колір ніка`);
    }
  };

  const defaults = getDefaultPanelPositions();

  return (
    <FloatingPanel
      panelId="toolbar"
      title="Меню"
      defaultPosition={defaults.toolbar}
      className="lobby-toolbar-panel"
      bodyClassName="lobby-toolbar-panel__body"
      zIndex={190}
    >
      <div className="lobby-toolbar card shadow border-0">
      <div className="card-header py-2 px-3 border-secondary bg-transparent">
        <strong>Учасники</strong>
        <span className="badge bg-secondary ms-2">{memberList.length}</span>
      </div>

      <ul className="list-group list-group-flush lobby-toolbar__members">
        {memberList.map((m) => (
          <li key={m.id} className="list-group-item bg-transparent text-light d-flex align-items-center gap-2 py-2">
            <span
              className={`lobby-toolbar__dot${m.isOnline ? ' lobby-toolbar__dot--online' : ''}`}
              style={{ background: m.color || '#888' }}
              title={m.isOnline ? 'Онлайн' : 'Офлайн'}
            />
            <span className="flex-grow-1 text-truncate" style={{ color: m.color }}>
              {m.nickname || 'Гість'}
              {m.id === lobby?.hostId && <span className="badge bg-warning text-dark ms-1">хост</span>}
              {lobby?.currentTurnUserId === m.id && (
                <span className="badge bg-info text-dark ms-1">хід</span>
              )}
            </span>
            {isHost && m.id !== userId && (
              <button
                type="button"
                className={`btn btn-sm ${m.canEdit === false ? 'btn-outline-danger' : 'btn-outline-success'}`}
                title="Доступ до поля"
                onClick={() => setMemberCanEdit(lobbyCode, m.id, m.canEdit === false)}
              >
                {m.canEdit === false ? '🔒' : '✎'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="card-body py-2 px-3 border-top border-secondary">
        <div className="d-grid gap-2">
          <Button
            size="sm"
            variant={textToolActive ? 'info' : 'outline-light'}
            onClick={onToggleTextTool}
            disabled={!canInteract}
          >
            📝 Текст
          </Button>
          <Button size="sm" variant="outline-success" onClick={onAddText} disabled={!canInteract}>
            + Нове вікно
          </Button>

          <p className="lobby-toolbar__hint small mb-0">
            Стрілка: кнопка ⟷ на блоці. Наслідок: виділіть текст → Shift+перетягніть
          </p>

          <Button
            size="sm"
            variant={canDeleteSelected ? 'danger' : 'outline-danger'}
            onClick={onDeleteSelected}
            disabled={!canDeleteSelected}
          >
            🗑 Видалити вибране
          </Button>

          <Button size="sm" variant="outline-light" onClick={onShowTemplates} disabled={!canInteract}>
            📋 Заготовки тексту
          </Button>

          <Button
            size="sm"
            variant={canUndo && canInteract ? 'info' : 'outline-secondary'}
            onClick={onUndo}
            disabled={!canUndo || !canInteract}
          >
            ↩ Скасувати
          </Button>

          <Button
            size="sm"
            variant="outline-light"
            onClick={onExportBoard}
            disabled={!canExportBoard}
          >
            📷 Знімок полотна
          </Button>

          <div className="lobby-toolbar__pencil-row">
            <Button
              size="sm"
              variant={drawTool === 'pencil' ? 'warning' : 'outline-light'}
              onClick={() => {
                toggleDrawTool('pencil');
                setShowPencilMenu((v) => (drawTool === 'pencil' ? !v : true));
              }}
              disabled={!canInteract}
              title="Малювання та налаштування"
            >
              ✏️ Олівець
            </Button>
            <Button
              size="sm"
              variant={drawTool === 'eraser' ? 'danger' : 'outline-light'}
              onClick={() => toggleDrawTool('eraser')}
              disabled={!canInteract}
              title="Стерти малюнок"
            >
              🧹 Гумка
            </Button>
            {showPencilMenu && (
              <div className="lobby-toolbar__pencil-menu" role="dialog" aria-label="Налаштування олівця">
                <div className="lobby-toolbar__pencil-menu-title">Олівець</div>
                <label className="form-label small mb-1">Колір олівця / стрілки</label>
                <ColorPicker value={pencilColor} onChange={onPencilColor} />
                <label className="form-label small mt-2">Товщина: {pencilWidth}px</label>
                <input
                  type="range"
                  min={1}
                  max={24}
                  value={pencilWidth}
                  className="form-range"
                  onChange={(e) => onPencilWidth(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {!editNickname ? (
            <Button
              size="sm"
              variant="outline-info"
              onClick={() => {
                setNickDraft(profile.nickname);
                setEditNickname(true);
              }}
            >
              Змінити нік
            </Button>
          ) : (
            <div className="input-group input-group-sm">
              <input
                className="form-control"
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value)}
              />
              <Button variant="success" onClick={applyNickname}>
                ✓
              </Button>
            </div>
          )}

          {!editColor ? (
            <Button size="sm" variant="outline-info" onClick={() => setEditColor(true)}>
              Змінити колір
            </Button>
          ) : (
            <div>
              <ColorPicker value={profile.color} onChange={applyColor} />
              <Button
                size="sm"
                variant="link"
                className="text-secondary"
                onClick={() => setEditColor(false)}
              >
                Закрити
              </Button>
            </div>
          )}
        </div>

        {isHost && (
          <div className="lobby-toolbar__host mt-3 pt-3 border-top border-secondary">
            <p className="small text-warning mb-2">Меню хоста</p>
            <Dropdown className="mb-2">
              <Dropdown.Toggle size="sm" variant="outline-warning" className="w-100">
                Передати хоста
              </Dropdown.Toggle>
              <Dropdown.Menu variant="dark">
                {memberList
                  .filter((m) => m.id !== userId)
                  .map((m) => (
                    <Dropdown.Item
                      key={m.id}
                      onClick={() => {
                        transferHost(lobbyCode, m.id);
                        onNotify(`Хост передано: ${m.nickname}`);
                      }}
                    >
                      {m.nickname}
                    </Dropdown.Item>
                  ))}
              </Dropdown.Menu>
            </Dropdown>

            <Dropdown className="mb-2">
              <Dropdown.Toggle size="sm" variant="outline-info" className="w-100">
                Передати хід
              </Dropdown.Toggle>
              <Dropdown.Menu variant="dark">
                {memberList.map((m) => (
                  <Dropdown.Item key={m.id} onClick={() => setCurrentTurn(lobbyCode, m.id)}>
                    {m.nickname}
                  </Dropdown.Item>
                ))}
                <Dropdown.Divider />
                <Dropdown.Item onClick={() => setCurrentTurn(lobbyCode, null)}>
                  Зняти обмеження ходу
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>

            <Button
              size="sm"
              variant={lobby?.turnsEnabled ? 'danger' : 'success'}
              className="w-100"
              onClick={() => setTurnsEnabled(lobbyCode, !lobby?.turnsEnabled)}
            >
              {lobby?.turnsEnabled ? 'Вимкнути ходи' : 'Увімкнути ходи'}
            </Button>
          </div>
        )}
      </div>
      </div>
    </FloatingPanel>
  );
}
