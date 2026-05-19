export function createUserId() {
  const stored = localStorage.getItem('discussion_board_user_id');
  if (stored) return stored;
  const id = `u_${crypto.randomUUID()}`;
  localStorage.setItem('discussion_board_user_id', id);
  return id;
}

export function generateLobbyCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
