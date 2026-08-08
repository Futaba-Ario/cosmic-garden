export async function shareCurrentUrl(): Promise<string> {
  const shareData = { title: 'いまの、太陽系。', text: '現在日時の太陽系を3Dで眺めてみて。', url: location.href };
  if (navigator.share) { await navigator.share(shareData); return '共有シートを開きました。'; }
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(location.href); return 'URLをコピーしました。'; }
  throw new Error('このブラウザでは共有またはコピーができません。');
}
