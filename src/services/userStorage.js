const PROFILE_KEY = 'discussion_board_profile';

const defaultProfile = {
  nickname: '',
  color: '#5865f2',
  arrowColor: '#5865f2',
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...defaultProfile };
    return { ...defaultProfile, ...JSON.parse(raw) };
  } catch {
    return { ...defaultProfile };
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function loadNotes(lobbyCode) {
  return localStorage.getItem(`notes_${lobbyCode}`) || '';
}

export function saveNotes(lobbyCode, text) {
  localStorage.setItem(`notes_${lobbyCode}`, text);
}

export function loadPanelLayout(panelId, defaults) {
  try {
    const raw = localStorage.getItem(`panel_layout_${panelId}`);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return {
      position: parsed.position || defaults.position,
      collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : defaults.collapsed,
    };
  } catch {
    return { ...defaults };
  }
}

export function savePanelLayout(panelId, layout) {
  localStorage.setItem(`panel_layout_${panelId}`, JSON.stringify(layout));
}

export function getDefaultPanelPositions() {
  const topOffset = 56;
  const margin = 16;
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    notes: { x: margin, y: topOffset + margin },
    minimap: { x: margin, y: h - 200 },
    toolbar: { x: w - 336, y: topOffset + margin },
  };
}
