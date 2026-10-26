// Server actions reject when the request never arrives (offline, dev server stopped, deploy in progress).
// Every admin action already returns its own failures as values; this turns a rejected call into one as well,
// so a form never gets stuck showing "Saving…".

const UNREACHABLE = "Couldn't reach the server. Check your connection, then try again.";

export async function callServer<T>(action: () => Promise<T>, failed: (message: string) => T): Promise<T> {
  try {
    return await action();
  } catch {
    return failed(UNREACHABLE);
  }
}
