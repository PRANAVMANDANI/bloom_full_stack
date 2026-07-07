/**
 * Format a date string or Date object into a readable format.
 */
export function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date for time display.
 */
export function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format relative time (e.g. "2 hours ago").
 */
export function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const seconds = Math.floor((now - d) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateStr);
}

/**
 * Get sentiment label and CSS class from compound score.
 */
export function getSentimentInfo(score) {
  if (score >= 0.3) return { label: 'Positive', cls: 'sentiment-positive', color: '#7fb685' };
  if (score >= -0.3) return { label: 'Neutral', cls: 'sentiment-neutral', color: '#e8a87c' };
  return { label: 'Negative', cls: 'sentiment-negative', color: '#e07a7a' };
}

/**
 * Get intensity class.
 */
export function getIntensityClass(intensity) {
  if (intensity <= 3) return 'intensity-low';
  if (intensity <= 6) return 'intensity-medium';
  return 'intensity-high';
}
