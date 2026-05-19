/** Працює в т.ч. у WebView без crypto.randomUUID (старі Android / in-app browser). */
export function randomUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const s4 = () =>
    Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export function createUserId() {
  const stored = localStorage.getItem('discussion_board_user_id');
  if (stored) return stored;
  const id = `u_${randomUUID()}`;
  localStorage.setItem('discussion_board_user_id', id);
  return id;
}

export function generateLobbyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
