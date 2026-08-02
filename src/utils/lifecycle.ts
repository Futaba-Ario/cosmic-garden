export function bindPageVisibility(onChange: (paused: boolean) => void): () => void {
  const handle = () => onChange(document.visibilityState === 'hidden');
  document.addEventListener('visibilitychange', handle);
  return () => document.removeEventListener('visibilitychange', handle);
}
