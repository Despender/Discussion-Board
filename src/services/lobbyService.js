import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  writeBatch,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore';
import { ref, set, onDisconnect, remove, onValue, update } from 'firebase/database';
import { db, rtdb, isFirebaseConfigured } from '../firebase/config';
import { clearLocalLobbyElements } from './elementService';
import { updateTextSelection } from './selectionService';
import { generateLobbyCode } from '../utils/ids';

const localLobbies = new Map();

function localLobby(code) {
  if (!localLobbies.has(code)) {
    localLobbies.set(code, {
      code,
      hostId: null,
      fontId: 'times',
      fontFamily: '"Times New Roman", Times, serif',
      fontSize: 18,
      arrowColor: '#5865f2',
      turnsEnabled: false,
      globalTurnLocked: false,
      currentTurnUserId: null,
      members: {},
      createdAt: Date.now(),
    });
  }
  return localLobbies.get(code);
}

export function getJoinedAtMs(member) {
  const j = member?.joinedAt;
  if (j == null) return Number.MAX_SAFE_INTEGER;
  if (typeof j === 'number') return j;
  if (typeof j.toMillis === 'function') return j.toMillis();
  if (typeof j.seconds === 'number') return j.seconds * 1000;
  return Number.MAX_SAFE_INTEGER;
}

export function pickEarliestMemberId(members) {
  let bestId = null;
  let bestTime = Number.MAX_SAFE_INTEGER;
  Object.entries(members || {}).forEach(([id, member]) => {
    const t = getJoinedAtMs(member);
    if (t < bestTime) {
      bestTime = t;
      bestId = id;
    }
  });
  return bestId;
}

async function deleteFirestoreCollection(collRef) {
  const snap = await getDocs(collRef);
  if (snap.empty) return;

  let batch = writeBatch(db);
  let ops = 0;

  const commitIfNeeded = async (force = false) => {
    if (ops === 0) return;
    if (force || ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  };

  for (const d of snap.docs) {
    batch.delete(d.ref);
    ops += 1;
    if (ops >= 450) await commitIfNeeded(true);
  }
  await commitIfNeeded(true);
}

async function deleteLobbyCompletely(code, { priorityDocDelete = false } = {}) {
  if (!isFirebaseConfigured) {
    localLobbies.delete(code);
    clearLocalLobbyElements(code);
    return;
  }

  const lobbyRef = doc(db, 'lobbies', code);
  const membersColl = collection(db, 'lobbies', code, 'members');
  const elementsColl = collection(db, 'lobbies', code, 'elements');

  if (priorityDocDelete) {
    try {
      await deleteDoc(lobbyRef);
    } catch (err) {
      console.error('deleteLobbyCompletely: lobby doc', code, err);
    }
    await Promise.allSettled([
      deleteFirestoreCollection(membersColl),
      deleteFirestoreCollection(elementsColl),
      rtdb ? remove(ref(rtdb, `presence/${code}`)) : Promise.resolve(),
      rtdb ? remove(ref(rtdb, `selections/${code}`)) : Promise.resolve(),
    ]);
    return;
  }

  await Promise.allSettled([
    deleteFirestoreCollection(membersColl),
    deleteFirestoreCollection(elementsColl),
  ]);

  try {
    await deleteDoc(lobbyRef);
  } catch (err) {
    console.error('deleteLobbyCompletely: lobby doc', code, err);
  }

  if (rtdb) {
    await Promise.allSettled([
      remove(ref(rtdb, `presence/${code}`)),
      remove(ref(rtdb, `selections/${code}`)),
    ]);
  }
}

async function deleteLobbyIfEmpty(code) {
  if (!isFirebaseConfigured) return false;

  const lobbySnap = await getDoc(doc(db, 'lobbies', code));
  if (!lobbySnap.exists()) return false;

  const membersSnap = await getDocs(collection(db, 'lobbies', code, 'members'));
  if (!membersSnap.empty) return false;

  await deleteLobbyCompletely(code);
  return true;
}

/** Видаляє «завислі» лобі без учасників (після закриття вкладки тощо). */
export async function pruneEmptyLobbies() {
  if (!isFirebaseConfigured) return;

  const lobbiesSnap = await getDocs(collection(db, 'lobbies'));
  await Promise.all(
    lobbiesSnap.docs.map(async (lobbyDoc) => {
      try {
        await deleteLobbyIfEmpty(lobbyDoc.id);
      } catch (err) {
        console.error('pruneEmptyLobbies', lobbyDoc.id, err);
      }
    })
  );
}

export async function createLobby({
  hostId,
  hostNickname,
  hostColor,
  fontId,
  fontFamily,
  fontSize,
  arrowColor,
}) {
  const resolvedArrowColor = arrowColor || '#5865f2';
  if (!isFirebaseConfigured) {
    const code = generateLobbyCode();
    const lobby = localLobby(code);
    lobby.hostId = hostId;
    lobby.fontId = fontId;
    lobby.fontFamily = fontFamily;
    lobby.fontSize = fontSize;
    lobby.arrowColor = resolvedArrowColor;
    lobby.members[hostId] = { joinedAt: Date.now(), canEdit: true };
    return code;
  }

  let code = generateLobbyCode();
  let exists = true;
  while (exists) {
    const snap = await getDoc(doc(db, 'lobbies', code));
    exists = snap.exists();
    if (exists) code = generateLobbyCode();
  }

  await setDoc(doc(db, 'lobbies', code), {
    code,
    hostId,
    fontId,
    fontFamily,
    fontSize,
    arrowColor: resolvedArrowColor,
    turnsEnabled: false,
    globalTurnLocked: false,
    currentTurnUserId: null,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'lobbies', code, 'members', hostId), {
    nickname: hostNickname || 'Хост',
    color: hostColor || '#5865f2',
    joinedAt: serverTimestamp(),
    canEdit: true,
  });

  return code;
}

export async function getLobby(code) {
  if (!isFirebaseConfigured) return localLobby(code);

  const snap = await getDoc(doc(db, 'lobbies', code));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function subscribeLobby(code, callback) {
  if (!isFirebaseConfigured) {
    callback(localLobby(code));
    return () => {};
  }

  return onSnapshot(doc(db, 'lobbies', code), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...snap.data() });
  });
}

export async function joinLobby(code, user) {
  if (!isFirebaseConfigured) {
    const lobby = localLobby(code);
    lobby.members[user.id] = {
      nickname: user.nickname,
      color: user.color,
      joinedAt: Date.now(),
      canEdit: true,
    };
    return lobby;
  }

  const lobbySnap = await getDoc(doc(db, 'lobbies', code));
  if (!lobbySnap.exists()) {
    throw new Error('Лобі не існує');
  }

  const membersSnap = await getDocs(collection(db, 'lobbies', code, 'members'));
  if (membersSnap.empty) {
    await deleteLobbyCompletely(code);
    throw new Error('Лобі не існує');
  }

  const memberRef = doc(db, 'lobbies', code, 'members', user.id);
  await setDoc(memberRef, {
    nickname: user.nickname,
    color: user.color,
    joinedAt: serverTimestamp(),
    canEdit: true,
  });
  return getLobby(code);
}

async function cleanupUserRealtime(code, userId) {
  if (!rtdb) return;
  await Promise.allSettled([
    remove(ref(rtdb, `presence/${code}/${userId}`)),
    updateTextSelection(code, userId, null),
  ]);
}

async function leaveLobbyLocal(code, userId) {
  const lobby = localLobbies.get(code);
  if (!lobby) return;

  const remaining = { ...lobby.members };
  delete remaining[userId];

  if (Object.keys(remaining).length > 0 && lobby.hostId === userId) {
    const nextHost = pickEarliestMemberId(remaining);
    if (nextHost) lobby.hostId = nextHost;
  }

  delete lobby.members[userId];

  if (Object.keys(remaining).length === 0) {
    await deleteLobbyCompletely(code);
  }
  await cleanupUserRealtime(code, userId);
}

/**
 * Вихід з лобі (Firestore):
 * 1) хост → найранішому joinedAt серед тих, хто залишиться;
 * 2) видалити учасника;
 * 3) якщо 0 учасників — видалити документ лобі (підколекції — у фоні).
 */
async function leaveLobbyFirestore(code, userId) {
  const lobbyRef = doc(db, 'lobbies', code);
  const memberRef = doc(db, 'lobbies', code, 'members', userId);
  const membersColl = collection(db, 'lobbies', code, 'members');

  const [lobbySnap, membersSnap] = await Promise.all([getDoc(lobbyRef), getDocs(membersColl)]);

  if (!lobbySnap.exists()) {
    await cleanupUserRealtime(code, userId);
    return;
  }

  const lobby = lobbySnap.data();
  const isMember = membersSnap.docs.some((d) => d.id === userId);

  const remainingMembers = {};
  membersSnap.forEach((d) => {
    if (d.id !== userId) remainingMembers[d.id] = d.data();
  });

  const othersCount = Object.keys(remainingMembers).length;
  const alone = isMember && othersCount === 0;

  if (lobby.hostId === userId && othersCount > 0) {
    const nextHost = pickEarliestMemberId(remainingMembers);
    const updates = {};
    if (nextHost) updates.hostId = nextHost;
    if (lobby.currentTurnUserId === userId) {
      updates.currentTurnUserId = deleteField();
      updates.globalTurnLocked = false;
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(lobbyRef, updates);
    }
  } else if (lobby.currentTurnUserId === userId && othersCount > 0) {
    await updateDoc(lobbyRef, {
      currentTurnUserId: deleteField(),
      globalTurnLocked: false,
    });
  }

  if (alone) {
    const batch = writeBatch(db);
    batch.delete(memberRef);
    batch.delete(lobbyRef);
    try {
      await batch.commit();
    } catch (err) {
      console.error('leaveLobby alone batch', err);
      await deleteDoc(memberRef).catch(() => {});
      await deleteDoc(lobbyRef).catch(() => {});
    }
    await cleanupUserRealtime(code, userId);
    void deleteLobbyCompletely(code, { priorityDocDelete: true });
    return;
  }

  if (isMember) {
    await deleteDoc(memberRef);
  }

  await cleanupUserRealtime(code, userId);

  if (membersSnap.empty || (isMember && othersCount === 0)) {
    void deleteLobbyCompletely(code, { priorityDocDelete: true });
  }
}

export async function leaveLobby(code, userId) {
  if (!code || !userId) return;

  if (!isFirebaseConfigured) {
    await leaveLobbyLocal(code, userId);
    return;
  }

  await leaveLobbyFirestore(code, userId);
}

/** Закриття вкладки — той самий вихід, що й leaveLobby. */
export function leaveLobbyOnUnload(code, userId) {
  void leaveLobby(code, userId);
}

export function subscribeMembers(code, callback) {
  if (!isFirebaseConfigured) {
    const lobby = localLobby(code);
    const emit = () => callback({ ...lobby.members });
    emit();
    const interval = setInterval(emit, 500);
    return () => clearInterval(interval);
  }

  let emptyCleanupTimer = null;

  const unsub = onSnapshot(collection(db, 'lobbies', code, 'members'), (snap) => {
    const members = {};
    snap.forEach((d) => {
      members[d.id] = d.data();
    });
    callback(members);

    if (emptyCleanupTimer) {
      clearTimeout(emptyCleanupTimer);
      emptyCleanupTimer = null;
    }

    if (snap.empty) {
      emptyCleanupTimer = setTimeout(() => {
        void deleteLobbyIfEmpty(code);
      }, 800);
    }
  });

  return () => {
    if (emptyCleanupTimer) clearTimeout(emptyCleanupTimer);
    unsub();
  };
}

export async function updateMemberProfile(code, userId, { nickname, color }) {
  if (!isFirebaseConfigured) {
    const lobby = localLobby(code);
    if (!lobby.members[userId]) return;
    if (nickname !== undefined) lobby.members[userId].nickname = nickname;
    if (color !== undefined) lobby.members[userId].color = color;
    return;
  }

  const payload = {};
  if (nickname !== undefined) payload.nickname = nickname;
  if (color !== undefined) payload.color = color;
  await updateDoc(doc(db, 'lobbies', code, 'members', userId), payload);
}

export async function setMemberCanEdit(code, userId, canEdit) {
  if (!isFirebaseConfigured) {
    localLobby(code).members[userId].canEdit = canEdit;
    return;
  }
  await updateDoc(doc(db, 'lobbies', code, 'members', userId), { canEdit });
}

export async function transferHost(code, newHostId) {
  if (!isFirebaseConfigured) {
    localLobby(code).hostId = newHostId;
    return;
  }
  await updateDoc(doc(db, 'lobbies', code), { hostId: newHostId });
}

export async function setTurnsEnabled(code, enabled) {
  if (!isFirebaseConfigured) {
    localLobby(code).turnsEnabled = enabled;
    return;
  }
  await updateDoc(doc(db, 'lobbies', code), { turnsEnabled: enabled });
}

export async function setCurrentTurn(code, userId) {
  if (!isFirebaseConfigured) {
    const lobby = localLobby(code);
    lobby.currentTurnUserId = userId;
    lobby.globalTurnLocked = Boolean(userId);
    return;
  }
  await updateDoc(doc(db, 'lobbies', code), {
    currentTurnUserId: userId || deleteField(),
    globalTurnLocked: Boolean(userId),
  });
}

export function subscribePresence(code, userId, profile, callback) {
  if (!isFirebaseConfigured || !rtdb) {
    callback({});
    return () => {};
  }

  const presenceRef = ref(rtdb, `presence/${code}/${userId}`);
  const connectedRef = ref(rtdb, '.info/connected');

  const unsubConnected = onValue(connectedRef, (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(presenceRef).remove();
    set(presenceRef, {
      nickname: profile.nickname,
      color: profile.color,
      x: 0,
      y: 0,
      updatedAt: Date.now(),
    });
  });

  const unsubPresence = onValue(ref(rtdb, `presence/${code}`), (snap) => {
    callback(snap.val() || {});
  });

  return () => {
    unsubConnected();
    unsubPresence();
    remove(presenceRef);
  };
}

export async function updateCursor(code, userId, x, y) {
  if (!isFirebaseConfigured || !rtdb) return;
  await update(ref(rtdb, `presence/${code}/${userId}`), {
    x,
    y,
    updatedAt: Date.now(),
  });
}

export function getLobbyShareUrl(code) {
  return `${window.location.origin}/lobby/${code}`;
}
