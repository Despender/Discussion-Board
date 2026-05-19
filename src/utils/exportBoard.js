const CANVAS_SIZE = 16000;

export async function exportBoardSnapshot(worldElement, filename = 'discussion-board.png') {
  if (!worldElement) throw new Error('Полотно не знайдено');

  const { default: html2canvas } = await import('html2canvas');

  const clone = worldElement.cloneNode(true);
  clone.style.transform = 'none';
  clone.style.position = 'absolute';
  clone.style.left = '0';
  clone.style.top = '0';
  clone.style.width = `${CANVAS_SIZE}px`;
  clone.style.height = `${CANVAS_SIZE}px`;

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = `${CANVAS_SIZE}px`;
  host.style.height = `${CANVAS_SIZE}px`;
  host.style.overflow = 'hidden';
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: '#1e1f22',
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      scale: 0.5,
      useCORS: true,
      logging: false,
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } finally {
    document.body.removeChild(host);
  }
}
