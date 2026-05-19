import { ref, onValue, update, remove, onDisconnect } from 'firebase/database';
import { rtdb, isFirebaseConfigured } from '../firebase/config';

const localSelections = new Map();

export function subscribeSelections(lobbyCode, callback) {
  if (!isFirebaseConfigured || !rtdb) {
    const emit = () => callback(Object.fromEntries(localSelections));
    emit();
    const interval = setInterval(emit, 400);
    return () => clearInterval(interval);
  }

  const selectionsRef = ref(rtdb, `selections/${lobbyCode}`);
  return onValue(selectionsRef, (snap) => {
    callback(snap.val() || {});
  });
}

export async function updateTextSelection(lobbyCode, userId, payload) {
  if (!isFirebaseConfigured || !rtdb) {
    if (!payload) {
      localSelections.delete(userId);
    } else {
      localSelections.set(userId, { userId, ...payload, updatedAt: Date.now() });
    }
    return;
  }

  const selRef = ref(rtdb, `selections/${lobbyCode}/${userId}`);
  if (!payload) {
    await remove(selRef);
    return;
  }

  await update(selRef, {
    ...payload,
    userId,
    updatedAt: Date.now(),
  });
  onDisconnect(selRef).remove();
}
