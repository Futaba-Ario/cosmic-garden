export async function saveCanvasPng(canvas: HTMLCanvasElement): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('画像を作成できませんでした。');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `solar-system-now-${new Date().toISOString().slice(0, 10)}.png`;
  link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
