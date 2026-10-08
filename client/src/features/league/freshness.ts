/** "just now", "5 min ago", "3 h ago", "2 days ago": how old data is, for the "updated" label. */
export function formatAge(fetchedAt: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(fetchedAt)) / 60_000));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
