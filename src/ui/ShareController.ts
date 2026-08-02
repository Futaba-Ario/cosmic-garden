export async function shareCurrentUrl(): Promise<string> {
  const shareData = { title: '星雲の庭', text: 'いまの空を見てみて。', url: location.href };
  if (navigator.share) { await navigator.share(shareData); return '共有シートを開きました。'; }
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(location.href); return 'URLをコピーしました。'; }
  throw new Error('このブラウザでは共有またはコピーができません。');
}
