import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { randomUUID } from '../utils/ids';

const localElements = new Map();

/** Firestore не приймає поля зі значенням undefined. */
function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Firestore не підтримує масиви масивів — зберігаємо точки як {x,y}. */
export function normalizeStrokePoints(points) {
  if (!points?.length) return [];
  if (Array.isArray(points[0])) {
    return points.map((pt) => [Number(pt[0]), Number(pt[1])]);
  }
  return points.map((pt) => [Number(pt.x), Number(pt.y)]);
}

function serializeStrokePoints(points) {
  return normalizeStrokePoints(points).map(([x, y]) => ({ x, y }));
}

function normalizeElementData(data) {
  if (!data || data.type !== 'stroke' || !data.points) return data;
  return { ...data, points: normalizeStrokePoints(data.points) };
}

function getLocalStore(code) {
  if (!localElements.has(code)) localElements.set(code, new Map());
  return localElements.get(code);
}

export function clearLocalLobbyElements(lobbyCode) {
  localElements.delete(lobbyCode);
}

export function subscribeElements(lobbyCode, callback) {
  if (!isFirebaseConfigured) {
    const emit = () => {
      const store = getLocalStore(lobbyCode);
      const elements = {};
      store.forEach((el, id) => {
        elements[id] = normalizeElementData({ id, ...el });
      });
      callback(elements);
    };
    emit();
    const interval = setInterval(emit, 300);
    return () => clearInterval(interval);
  }

  return onSnapshot(collection(db, 'lobbies', lobbyCode, 'elements'), (snap) => {
    const elements = {};
    snap.forEach((d) => {
      elements[d.id] = normalizeElementData({ id: d.id, ...d.data() });
    });
    callback(elements);
  });
}

export async function createTextElement(lobbyCode, payload) {
  const id = `t_${randomUUID()}`;
  const data = {
    type: 'text',
    x: payload.x,
    y: payload.y,
    width: payload.width ?? 300,
    html: payload.html ?? '',
    align: payload.align ?? 'left',
    finalized: false,
    compact: payload.compact ?? false,
    role: payload.role ?? null,
    height: payload.height ?? 60,
    consequenceOffset: payload.consequenceOffset ?? 0,
    isPrivate: payload.isPrivate ?? false,
    revealed: payload.isPrivate ? false : true,
    authorId: payload.authorId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (!isFirebaseConfigured) {
    getLocalStore(lobbyCode).set(id, { id, ...data });
    return { id, ...data };
  }

  await setDoc(
    doc(db, 'lobbies', lobbyCode, 'elements', id),
    stripUndefined({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return { id, ...data };
}

export async function updateElement(lobbyCode, id, patch) {
  if (!isFirebaseConfigured) {
    const store = getLocalStore(lobbyCode);
    const prev = store.get(id);
    if (!prev) return;
    store.set(id, { ...prev, ...patch, updatedAt: Date.now() });
    return;
  }

  await updateDoc(
    doc(db, 'lobbies', lobbyCode, 'elements', id),
    stripUndefined({
      ...patch,
      updatedAt: serverTimestamp(),
    })
  );
}

export async function restoreElement(lobbyCode, element) {
  if (!element?.id) return;
  if (!isFirebaseConfigured) {
    getLocalStore(lobbyCode).set(element.id, element);
    return;
  }
  const normalized = normalizeElementData(element);
  const payload = { ...normalized };
  if (normalized.type === 'stroke') {
    payload.points = serializeStrokePoints(normalized.points);
  }
  await setDoc(
    doc(db, 'lobbies', lobbyCode, 'elements', element.id),
    stripUndefined(payload)
  );
}

export async function deleteElement(lobbyCode, id) {
  if (!isFirebaseConfigured) {
    getLocalStore(lobbyCode).delete(id);
    return;
  }
  await deleteDoc(doc(db, 'lobbies', lobbyCode, 'elements', id));
}

export async function deleteConsequence(lobbyCode, consequenceId, elements) {
  const c = elements[consequenceId];
  if (!c || c.type !== 'consequence') return;

  const ids = [
    consequenceId,
    c.premiseId,
    c.conclusionId,
    c.arrowId,
    c.sourceArrowId,
  ].filter(Boolean);
  await Promise.all(ids.map((id) => deleteElement(lobbyCode, id)));

  const source = elements[c.sourceId];
  if (source?.type === 'text') {
    const remaining = Object.values(elements).filter(
      (el) =>
        el.type === 'consequence' &&
        el.sourceId === c.sourceId &&
        el.id !== consequenceId
    );
    if (!remaining.length) {
      await updateElement(lobbyCode, c.sourceId, { consequenceOffset: 0 });
    }
  }
}

export async function deleteTextBlock(lobbyCode, textId, elements) {
  const related = Object.values(elements).filter(
    (el) =>
      el.id === textId ||
      (el.type === 'consequence' &&
        (el.sourceId === textId || el.premiseId === textId || el.conclusionId === textId)) ||
      (el.type === 'arrow' && (el.fromId === textId || el.toId === textId))
  );

  const ids = new Set();
  related.forEach((el) => {
    ids.add(el.id);
    if (el.type === 'consequence') {
      ids.add(el.premiseId);
      ids.add(el.conclusionId);
      ids.add(el.arrowId);
      ids.add(el.sourceArrowId);
    }
  });

  await Promise.all([...ids].filter(Boolean).map((id) => deleteElement(lobbyCode, id)));
}

export async function createStroke(lobbyCode, { points, color, width, authorId, isPrivate }) {
  const id = `s_${randomUUID()}`;
  const normalizedPoints = normalizeStrokePoints(points);
  const data = {
    type: 'stroke',
    points: normalizedPoints,
    color,
    width,
    isPrivate: isPrivate ?? false,
    revealed: isPrivate ? false : true,
    authorId,
    createdAt: Date.now(),
  };

  if (!isFirebaseConfigured) {
    getLocalStore(lobbyCode).set(id, { id, ...data });
    return { id, ...data };
  }

  await setDoc(
    doc(db, 'lobbies', lobbyCode, 'elements', id),
    stripUndefined({
      ...data,
      points: serializeStrokePoints(normalizedPoints),
      createdAt: serverTimestamp(),
    })
  );
  return { id, ...data };
}

export async function createArrow(lobbyCode, payload) {
  const id = `a_${randomUUID()}`;
  const data = stripUndefined({
    type: 'arrow',
    fromId: payload.fromId || null,
    fromX: payload.fromX,
    fromY: payload.fromY,
    fromAnchorX: payload.fromAnchorX,
    fromAnchorY: payload.fromAnchorY,
    fromAnchorRelX: payload.fromAnchorRelX,
    fromAnchorRelY: payload.fromAnchorRelY,
    toId: payload.toId || null,
    toX: payload.toX,
    toY: payload.toY,
    color: payload.color,
    isPrivate: payload.isPrivate ?? false,
    revealed: payload.isPrivate ? false : true,
    authorId: payload.authorId,
    createdAt: Date.now(),
  });

  if (!isFirebaseConfigured) {
    getLocalStore(lobbyCode).set(id, { id, ...data });
    return { id, ...data };
  }

  await setDoc(
    doc(db, 'lobbies', lobbyCode, 'elements', id),
    stripUndefined({
      ...data,
      createdAt: serverTimestamp(),
    })
  );
  return { id, ...data };
}

export async function createConsequence(lobbyCode, payload) {
  const {
    sourceElement,
    anchorX,
    anchorY,
    endX,
    endY,
    color,
    authorId,
    isPrivate,
    selectionHtml,
  } = payload;
  const privateFlag = isPrivate ?? false;
  const quoteHtml = (selectionHtml || '').trim() || '…';
  const symbolX = anchorX + 44;
  const symbolY = anchorY - 4;
  const sourceWidth = sourceElement.width ?? 300;
  const premiseWidth = Math.min(320, Math.max(160, quoteHtml.length * 4));
  const gap = 40;

  const premise = await createTextElement(lobbyCode, {
    x: sourceElement.x + sourceWidth + gap,
    y: sourceElement.y,
    width: premiseWidth,
    html: quoteHtml,
    align: 'left',
    finalized: false,
    compact: false,
    role: 'premise',
    authorId,
    isPrivate: privateFlag,
  });

  const conclusion = await createTextElement(lobbyCode, {
    x: endX - 110,
    y: endY - 28,
    width: 220,
    html: '',
    align: 'left',
    finalized: false,
    role: 'conclusion',
    authorId,
    isPrivate: privateFlag,
  });

  const sourceArrow = await createArrow(lobbyCode, {
    fromId: sourceElement.id,
    toId: premise.id,
    color: color || '#5865f2',
    authorId,
    isPrivate: privateFlag,
  });

  const arrow = await createArrow(lobbyCode, {
    fromId: premise.id,
    toId: conclusion.id,
    color: color || '#5865f2',
    authorId,
    isPrivate: privateFlag,
  });

  const id = `c_${randomUUID()}`;
  const data = {
    type: 'consequence',
    sourceId: sourceElement.id,
    symbolX,
    symbolY,
    anchorX,
    anchorY,
    premiseId: premise.id,
    conclusionId: conclusion.id,
    sourceArrowId: sourceArrow.id,
    arrowId: arrow.id,
    authorId,
    isPrivate: privateFlag,
    revealed: !privateFlag,
    createdAt: Date.now(),
  };

  if (!isFirebaseConfigured) {
    getLocalStore(lobbyCode).set(id, { id, ...data });
  } else {
    await setDoc(
      doc(db, 'lobbies', lobbyCode, 'elements', id),
      stripUndefined({
        ...data,
        createdAt: serverTimestamp(),
      })
    );
  }

  const prevOffset = sourceElement.consequenceOffset || 0;
  await updateElement(lobbyCode, sourceElement.id, {
    consequenceOffset: Math.max(prevOffset, 48),
  });

  return { id, ...data, premise, conclusion, arrow, sourceArrow };
}
