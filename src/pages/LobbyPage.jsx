import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import CanvasBoard from '../components/canvas/CanvasBoard';
import BoardMinimap from '../components/canvas/BoardMinimap';
import LobbyToolbar from '../components/lobby/LobbyToolbar';
import NotesPanel from '../components/lobby/NotesPanel';
import ToastStack from '../components/lobby/ToastStack';
import TextTemplatesPanel from '../components/lobby/TextTemplatesPanel';
import { useUser } from '../context/UserContext';
import {
  joinLobby,
  leaveLobby,
  leaveLobbyOnUnload,
  subscribeLobby,
  subscribeMembers,
  subscribePresence,
  updateMemberProfile,
  getLobbyShareUrl,
} from '../services/lobbyService';
import {
  subscribeElements,
  createTextElement,
  updateElement,
  createStroke,
  deleteElement,
  createArrow,
  createConsequence,
  deleteConsequence,
  deleteTextBlock,
  restoreElement,
} from '../services/elementService';
import { createUndoStack } from '../services/undoService';
import { subscribeSelections, updateTextSelection } from '../services/selectionService';
import { exportBoardSnapshot } from '../utils/exportBoard';
import { loadLobbyFont, ALL_FONTS } from '../constants/fonts';
import { HOME_LOBBY_MENU } from '../utils/appNavigation';
import './LobbyPage.css';

export default function LobbyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { userId, profile, setProfile } = useUser();
  const canvasRef = useRef(null);
  const undoStack = useRef(createUndoStack());
  const [lobby, setLobby] = useState(null);
  const [members, setMembers] = useState({});
  const [elements, setElements] = useState({});
  const [presence, setPresence] = useState({});
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [drawTool, setDrawTool] = useState('none');
  const [textToolActive, setTextToolActive] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [remoteSelections, setRemoteSelections] = useState({});
  const [exporting, setExporting] = useState(false);
  const [viewport, setViewport] = useState({
    pan: { x: 0, y: 0 },
    scale: 1,
    viewportSize: { width: 800, height: 600 },
  });
  const [canUndo, setCanUndo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinDone, setJoinDone] = useState(false);
  const [lobbySynced, setLobbySynced] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [isLeaving, setIsLeaving] = useState(false);
  const [pencilColor, setPencilColor] = useState(profile.color);
  const [pencilWidth, setPencilWidth] = useState(3);
  const [textHighlightColor] = useState('#fee75c');
  const joinedRef = useRef(false);
  const leavingRef = useRef(false);
  const pageHideReadyRef = useRef(false);
  const prevMembersRef = useRef({});
  const prevTurnUserRef = useRef(null);
  const selectionDebounceRef = useRef(null);

  const setTool = (tool) => {
    setDrawTool(tool);
    if (tool !== 'none') setTextToolActive(false);
  };

  const pushToast = useCallback((message) => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const recordUndo = useCallback((action) => {
    undoStack.current.push(action);
    setCanUndo(undoStack.current.canUndo());
  }, []);

  const myMember = members[userId];
  const isActiveMember = Boolean(myMember) && !isLeaving;
  const canEdit = isActiveMember && myMember?.canEdit !== false;
  const isMyTurn =
    !lobby?.turnsEnabled ||
    !lobby?.globalTurnLocked ||
    lobby?.currentTurnUserId === userId;
  const canLink = isActiveMember && isMyTurn;
  const canInteract = canEdit && isMyTurn;
  const canUndoNow = canUndo && canInteract;

  useEffect(() => {
    if (!profile.nickname?.trim()) {
      navigate('/', { replace: true });
    }
  }, [profile.nickname, navigate]);

  useEffect(() => {
    let cancelled = false;

    const unsubLobby = subscribeLobby(code, (data) => {
      if (!cancelled) {
        setLobby(data);
        setLobbySynced(true);
      }
    });

    const unsubMembers = subscribeMembers(code, (m) => {
      if (cancelled) return;
      const prev = prevMembersRef.current;
      Object.entries(m).forEach(([id, member]) => {
        const old = prev[id];
        if (old && id !== userId) {
          if (old.nickname !== member.nickname) {
            pushToast(`«${old.nickname}» змінив(ла) нікнейм на «${member.nickname}»`);
          }
          if (old.color !== member.color) {
            pushToast(`«${member.nickname}» змінив(ла) колір ніка`);
          }
        }
      });
      prevMembersRef.current = m;
      setMembers(m);
    });

    const unsubElements = subscribeElements(code, (els) => {
      if (!cancelled) setElements(els);
    });

    return () => {
      cancelled = true;
      unsubLobby();
      unsubMembers();
      unsubElements();
    };
  }, [code, userId, pushToast]);

  useEffect(() => {
    let cancelled = false;

    const enter = async () => {
      if (joinedRef.current) return;
      setLoading(true);
      setJoinDone(false);
      setLobbySynced(false);
      setError('');
      try {
        await joinLobby(code, {
          id: userId,
          nickname: profile.nickname,
          color: profile.color,
        });
        if (!cancelled) joinedRef.current = true;
      } catch {
        if (!cancelled) setError('Не вдалося підключитися до лобі');
      } finally {
        if (!cancelled) setJoinDone(true);
      }
    };

    enter();

    return () => {
      cancelled = true;
    };
  }, [code, userId, profile.nickname, profile.color]);

  useEffect(() => {
    if (!joinDone || !lobbySynced) return;
    setLoading(false);
    if (!lobby && !error) {
      setError('Лобі не знайдено');
    }
  }, [joinDone, lobbySynced, lobby, error]);

  useEffect(() => {
    if (!lobby?.fontId) return;
    const font = ALL_FONTS.find((f) => f.id === lobby.fontId);
    if (font) loadLobbyFont(font);
  }, [lobby?.fontId]);

  useEffect(() => {
    if (!code) return undefined;
    return subscribePresence(code, userId, profile, setPresence);
  }, [code, userId, profile.nickname, profile.color]);

  useEffect(() => subscribeSelections(code, setRemoteSelections), [code]);

  const runLeaveLobby = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    joinedRef.current = false;
    leaveLobbyOnUnload(code, userId);
  }, [code, userId]);

  const handleExitLobby = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    joinedRef.current = false;
    setIsLeaving(true);

    navigate(HOME_LOBBY_MENU, { replace: true });

    void leaveLobby(code, userId).catch((err) => {
      console.error('leaveLobby failed', err);
    });
  }, [code, userId, navigate]);

  useEffect(() => {
    const readyTimer = window.setTimeout(() => {
      pageHideReadyRef.current = true;
    }, 2500);

    const onPageHide = (e) => {
      if (e.persisted) return;
      if (!pageHideReadyRef.current) return;
      if (!joinedRef.current || leavingRef.current) return;
      runLeaveLobby();
    };

    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [runLeaveLobby]);

  const handleUndo = useCallback(async () => {
    if (!canInteract || !undoStack.current.canUndo()) return;

    const action = undoStack.current.pop();
    setCanUndo(undoStack.current.canUndo());
    if (!action) return;

    if (action.type === 'CREATE') {
      await deleteElement(code, action.id);
      if (selectedElementId === action.id) setSelectedElementId(null);
    } else if (action.type === 'DELETE') {
      await restoreElement(code, action.element);
    } else if (action.type === 'DELETE_MANY') {
      await Promise.all(action.elements.map((el) => restoreElement(code, el)));
    } else if (action.type === 'UPDATE') {
      await updateElement(code, action.id, action.before);
    }
    pushToast('Скасовано останню дію');
  }, [code, pushToast, selectedElementId, canInteract]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (canInteract && undoStack.current.canUndo()) {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, canInteract]);

  const handleProfileChange = async (patch) => {
    setProfile(patch);
    await updateMemberProfile(code, userId, patch);
  };

  const handleAddText = async (template) => {
    const center = canvasRef.current?.getViewportCenter() ?? { x: 8000, y: 8000 };
    const el = await createTextElement(code, {
      x: center.x - 150,
      y: center.y - 40,
      html: template?.html ?? '',
      authorId: userId,
    });
    recordUndo({ type: 'CREATE', id: el.id });
    setSelectedElementId(el.id);
    setTextToolActive(true);
    setDrawTool('none');
  };

  const handleUpdateElement = async (id, patch) => {
    setElements((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
    await updateElement(code, id, patch);
  };

  const handleFinalizeElement = async (id) => {
    const before = elements[id] ? { ...elements[id] } : null;
    await updateElement(code, id, { finalized: true });
    setSelectedElementId(id);
    if (before) recordUndo({ type: 'UPDATE', id, before });
  };

  const handleSaveStroke = async (strokeData) => {
    const el = await createStroke(code, { ...strokeData, authorId: userId });
    recordUndo({ type: 'CREATE', id: el.id });
  };

  const handleEraseStrokes = async (ids) => {
    const snapshots = ids.map((id) => ({ ...elements[id] })).filter((e) => e.id);
    await Promise.all(ids.map((id) => deleteElement(code, id)));
    if (snapshots.length) recordUndo({ type: 'DELETE_MANY', elements: snapshots });
  };

  const handleCreateArrow = async (payload) => {
    const arrow = await createArrow(code, {
      ...payload,
      toId: payload.toId || null,
      toX: payload.toX,
      toY: payload.toY,
      authorId: userId,
    });
    recordUndo({ type: 'CREATE', id: arrow.id });
  };

  const handleCreateConsequence = async (payload) => {
    const source = payload?.sourceElement || elements[selectedElementId];
    if (!source || source.type !== 'text') return;

    let anchorX = payload?.anchorX;
    let anchorY = payload?.anchorY;
    let endX = payload?.endX;
    let endY = payload?.endY;

    if (anchorX == null) {
      const w = source.width ?? 300;
      anchorX = source.x + w / 2;
      anchorY = source.y;
      endX = anchorX + 200;
      endY = anchorY + 100;
    }

    if (!payload?.selectionHtml && !payload?.fromDrag) {
      pushToast('Виділіть фрагмент тексту та перетягніть із зажатим Shift');
      return;
    }

    const result = await createConsequence(code, {
      sourceElement: source,
      anchorX,
      anchorY,
      endX,
      endY,
      color: lobby?.arrowColor || '#5865f2',
      authorId: userId,
      selectionHtml: payload?.selectionHtml,
    });
    [result.id, result.premise?.id, result.conclusion?.id, result.arrow?.id, result.sourceArrow?.id]
      .filter(Boolean)
      .forEach((id) => recordUndo({ type: 'CREATE', id }));
    setSelectedElementId(result.conclusionId);
    pushToast('Створено наслідок ⟹');
  };

  const handleUpdateArrow = async (arrowId, patch) => {
    const before = elements[arrowId] ? { ...elements[arrowId] } : null;
    setElements((prev) => ({
      ...prev,
      [arrowId]: { ...prev[arrowId], ...patch },
    }));
    await updateElement(code, arrowId, patch);
    if (before) recordUndo({ type: 'UPDATE', id: arrowId, before });
  };

  const collectDeleteSnapshots = (id) => {
    const el = elements[id];
    if (!el) return [];
    if (el.type === 'consequence') {
      return [
        el,
        elements[el.premiseId],
        elements[el.conclusionId],
        elements[el.arrowId],
        elements[el.sourceArrowId],
      ].filter(Boolean);
    }
    if (el.type === 'text') {
      const related = Object.values(elements).filter(
        (item) =>
          item.type === 'consequence' &&
          (item.sourceId === id || item.premiseId === id || item.conclusionId === id)
      );
      const ids = new Set([id]);
      related.forEach((c) => {
        ids.add(c.id);
        ids.add(c.premiseId);
        ids.add(c.conclusionId);
        ids.add(c.arrowId);
        ids.add(c.sourceArrowId);
      });
      return [...ids].map((i) => elements[i]).filter(Boolean);
    }
    if (el.type === 'arrow') {
      const linked = Object.values(elements).find(
        (item) =>
          item.type === 'consequence' &&
          (item.arrowId === id || item.sourceArrowId === id)
      );
      if (linked) return collectDeleteSnapshots(linked.id);
    }
    return [el];
  };

  const handleDeleteSelected = async () => {
    if (!selectedElementId) return;
    const snapshots = collectDeleteSnapshots(selectedElementId).map((e) => ({ ...e }));
    const el = elements[selectedElementId];

    if (el.type === 'consequence') {
      await deleteConsequence(code, selectedElementId, elements);
    } else if (el.type === 'text') {
      await deleteTextBlock(code, selectedElementId, elements);
    } else if (el.type === 'arrow') {
      const linked = Object.values(elements).find(
        (item) =>
          item.type === 'consequence' &&
          (item.arrowId === selectedElementId || item.sourceArrowId === selectedElementId)
      );
      if (linked) {
        await deleteConsequence(code, linked.id, elements);
      } else {
        await deleteElement(code, selectedElementId);
      }
    } else {
      await deleteElement(code, selectedElementId);
    }

    recordUndo({ type: 'DELETE_MANY', elements: snapshots });
    setSelectedElementId(null);
    pushToast('Видалено');
  };

  const selectedEl = selectedElementId ? elements[selectedElementId] : null;
  const canDeleteSelected = canLink && Boolean(selectedEl);

  useEffect(() => {
    const turnUser = lobby?.currentTurnUserId;
    if (turnUser !== userId) {
      prevTurnUserRef.current = turnUser;
      return;
    }
    if (prevTurnUserRef.current === userId) return;
    prevTurnUserRef.current = userId;

    const privates = Object.values(elements).filter(
      (el) => el.authorId === userId && el.isPrivate && !el.revealed
    );
    if (!privates.length) return;

    privates.forEach((el) => {
      updateElement(code, el.id, { revealed: true, isPrivate: false });
    });
    pushToast('Ваші чернетки відкрито на початку ходу');
  }, [lobby?.currentTurnUserId, userId, elements, code, pushToast]);

  const handleReportSelection = useCallback(
    (payload) => {
      clearTimeout(selectionDebounceRef.current);
      selectionDebounceRef.current = setTimeout(() => {
        if (payload?.start != null && payload?.end != null) {
          updateTextSelection(code, userId, {
            elementId: payload.elementId,
            start: payload.start,
            end: payload.end,
            nickname: profile.nickname,
            color: profile.color,
          });
        } else {
          updateTextSelection(code, userId, null);
        }
      }, 150);
    },
    [code, userId, profile.nickname, profile.color]
  );

  const handleExportBoard = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const world = canvasRef.current?.getWorldElement?.();
      await exportBoardSnapshot(world, `board-${code}.png`);
      pushToast('Знімок полотна збережено');
    } catch {
      pushToast('Не вдалося зробити знімок');
    } finally {
      setExporting(false);
    }
  }, [code, exporting, pushToast]);

  const remoteSelectionsByElement = useMemo(() => {
    const map = {};
    Object.entries(remoteSelections).forEach(([uid, sel]) => {
      if (uid === userId || !sel?.elementId || sel.start == null) return;
      if (!map[sel.elementId]) map[sel.elementId] = sel;
    });
    return map;
  }, [remoteSelections, userId]);

  if (loading) {
    return (
      <div className="lobby-page lobby-page--loading">
        <p className="text-light">Завантаження лобі…</p>
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="lobby-page lobby-page--error text-center text-light p-4">
        <p>{error || 'Лобі не знайдено'}</p>
        <Link to={{ pathname: '/', search: '?lobbyMenu=1' }} className="btn btn-primary">
          На головну
        </Link>
      </div>
    );
  }

  const blockFontFamily = lobby.fontFamily || '"Times New Roman", Times, serif';
  const blockFontSize = lobby.fontSize || 18;
  const lobbyArrowColor = lobby.arrowColor || '#5865f2';

  return (
    <div className="lobby-page">
      <header className="lobby-page__topbar">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={handleExitLobby}
          disabled={isLeaving}
        >
          {isLeaving ? 'Вихід…' : '← Вийти'}
        </Button>
        <span className="lobby-page__code">
          Код: <strong>{code}</strong>
        </span>
        <Button
          size="sm"
          variant="outline-info"
          onClick={() => navigator.clipboard?.writeText(getLobbyShareUrl(code))}
        >
          Копіювати посилання
        </Button>
        {!canLink && <span className="badge bg-danger ms-2">Зараз не ваш хід</span>}
        {canLink && !canEdit && (
          <span className="badge bg-warning text-dark ms-2">
            Лише зв’язки / перегляд (без редагування тексту)
          </span>
        )}
      </header>

      <CanvasBoard
        ref={canvasRef}
        lobbyCode={code}
        userId={userId}
        presence={presence}
        pencilColor={pencilColor}
        arrowColor={lobbyArrowColor}
        pencilWidth={pencilWidth}
        drawTool={drawTool}
        textToolActive={textToolActive}
        canInteract={canInteract}
        canLink={canLink}
        elements={elements}
        selectedElementId={selectedElementId}
        onSelectElement={setSelectedElementId}
        onUpdateElement={handleUpdateElement}
        onFinalizeElement={handleFinalizeElement}
        onSaveStroke={handleSaveStroke}
        onEraseStrokes={handleEraseStrokes}
        onCreateArrow={handleCreateArrow}
        onCreateConsequence={handleCreateConsequence}
        onUpdateArrow={handleUpdateArrow}
        textHighlightColor={textHighlightColor}
        remoteSelectionsByElement={remoteSelectionsByElement}
        onReportSelection={handleReportSelection}
        onViewportChange={setViewport}
        blockFontFamily={blockFontFamily}
        blockFontSize={blockFontSize}
      />

      <BoardMinimap
        elements={elements}
        viewportPan={viewport.pan}
        viewportScale={viewport.scale}
        viewportSize={viewport.viewportSize}
        onNavigate={(x, y) => canvasRef.current?.navigateToWorld?.(x, y)}
      />

      <NotesPanel lobbyCode={code} />

      <LobbyToolbar
        lobby={lobby}
        lobbyCode={code}
        userId={userId}
        members={members}
        presence={presence}
        profile={profile}
        onProfileChange={handleProfileChange}
        onNotify={pushToast}
        drawTool={drawTool}
        onSetDrawTool={setTool}
        pencilColor={pencilColor}
        pencilWidth={pencilWidth}
        onPencilColor={setPencilColor}
        onPencilWidth={setPencilWidth}
        textToolActive={textToolActive}
        onToggleTextTool={() => {
          setTextToolActive((v) => !v);
          if (!textToolActive) setDrawTool('none');
        }}
        onAddText={() => handleAddText()}
        onDeleteSelected={handleDeleteSelected}
        canDeleteSelected={canDeleteSelected}
        onShowTemplates={() => setShowTemplates(true)}
        onUndo={handleUndo}
        canUndo={canUndoNow}
        onExportBoard={handleExportBoard}
        canExportBoard={!exporting}
        canLink={canLink}
      />

      <TextTemplatesPanel
        show={showTemplates}
        onHide={() => setShowTemplates(false)}
        onPick={(t) => handleAddText(t)}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}
