/** Reads a short message aloud through the page's polite live region (#sr-status in the site layout). */
export function say(message: string): void {
  const status = document.getElementById('sr-status');
  if (!status) return;
  // Cleared first, so the same message twice in a row is still announced.
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = message;
  });
}
