/** Маршрут головної сторінки з відкритим меню лобі. */
export const HOME_LOBBY_MENU = { pathname: '/', search: '?lobbyMenu=1' };

export function isLobbyMenuSearch() {
  return new URLSearchParams(window.location.search).get('lobbyMenu') === '1';
}

/** Повний URL кореня застосунку (з урахуванням PUBLIC_URL на хостингу). */
export function getHomeUrl(openLobbyMenu = false) {
  const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
  const base = publicUrl ? `${publicUrl}/` : '/';
  const origin = window.location.origin;
  const search = openLobbyMenu ? '?lobbyMenu=1' : '';
  return `${origin}${base}${search}`;
}
