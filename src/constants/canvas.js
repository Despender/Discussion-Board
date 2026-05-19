/** Логічний розмір світу полотна (координати елементів). */
export const CANVAS_SIZE = 16000;

const DESKTOP_MAX_BACKING = 8192;
const MOBILE_MAX_BACKING = 4096;

function isMobileLikeDevice() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(max-width: 1024px) and (pointer: coarse)')?.matches) {
    return true;
  }
  const ua = navigator.userAgent || '';
  return /Android|webOS|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
}

/** Максимальний розмір backing-store canvas, який браузер реально підтримує. */
export function probeMaxCanvasBackingDim() {
  if (typeof document === 'undefined') {
    return isMobileLikeDevice() ? MOBILE_MAX_BACKING : DESKTOP_MAX_BACKING;
  }

  const cap = isMobileLikeDevice() ? MOBILE_MAX_BACKING : DESKTOP_MAX_BACKING;
  const candidates = [cap, 6144, 4096, 3072, 2048];

  try {
    const probe = document.createElement('canvas');
    for (const size of candidates) {
      probe.width = size;
      probe.height = size;
      if (probe.width === size && probe.height === size) {
        return size;
      }
    }
  } catch {
    /* ignore */
  }

  return 2048;
}

let cachedBacking = null;

/** Розмір bitmap для шару малювання (≤ CANVAS_SIZE). */
export function getDrawCanvasBackingSize() {
  if (cachedBacking == null) {
    cachedBacking = Math.min(CANVAS_SIZE, probeMaxCanvasBackingDim());
  }
  return cachedBacking;
}

export function getDrawCanvasScale() {
  return getDrawCanvasBackingSize() / CANVAS_SIZE;
}
