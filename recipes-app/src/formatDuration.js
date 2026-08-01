// Mirrors generate-index.js's formatDuration so the replica matches the built pages.
export default function formatDuration(iso, lang) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const hrs = parseInt(m[1] || '0', 10);
  const mins = parseInt(m[2] || '0', 10);
  if (lang === 'ar') {
    if (hrs && mins) return `${hrs} ساعة ${mins} دقيقة`;
    if (hrs) return `${hrs} ساعة`;
    return `${mins} دقيقة`;
  }
  if (hrs && mins) return `${hrs} hr ${mins} min`;
  if (hrs) return `${hrs} hr`;
  return `${mins} minutes`;
}
