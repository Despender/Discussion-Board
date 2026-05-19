/**
 * Підписка на зміну розміру елемента. Якщо ResizeObserver недоступний
 * (старі мобільні WebView), використовується resize/orientation + інтервал.
 *
 * @param {Element} element
 * @param {(size: { width: number; height: number }) => void} callback
 * @returns {() => void} cleanup
 */
export function observeElementResize(element, callback) {
  if (!element || typeof callback !== 'function') {
    return () => {};
  }

  const emit = () => {
    const rect = element.getBoundingClientRect();
    callback({ width: rect.width, height: rect.height });
  };

  if (typeof ResizeObserver !== 'undefined') {
    try {
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry?.contentRect) {
          const { width, height } = entry.contentRect;
          callback({ width, height });
        } else {
          emit();
        }
      });
      ro.observe(element);
      emit();
      return () => {
        try {
          ro.disconnect();
        } catch {
          /* ignore */
        }
      };
    } catch {
      /* fall through */
    }
  }

  emit();
  const onWin = () => emit();
  window.addEventListener('resize', onWin);
  window.addEventListener('orientationchange', onWin);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onWin);
  }
  const intervalId = window.setInterval(emit, 400);
  return () => {
    window.removeEventListener('resize', onWin);
    window.removeEventListener('orientationchange', onWin);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', onWin);
    }
    window.clearInterval(intervalId);
  };
}
