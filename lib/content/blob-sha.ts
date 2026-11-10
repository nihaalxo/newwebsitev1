/**
 * The id git gives a file's contents: SHA-1 of "blob <length>\0" followed by the bytes. The admin compares these
 * with GitHub's tree and with the build's admin/data/index.json to know which version of a file is where. Uses
 * crypto.subtle, so the same code runs in Node, the browser and the Worker.
 */
export async function gitBlobSha(content: Uint8Array | string): Promise<string> {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const header = new TextEncoder().encode(`blob ${bytes.byteLength}\0`);
  const whole = new Uint8Array(header.byteLength + bytes.byteLength);
  whole.set(header, 0);
  whole.set(bytes, header.byteLength);
  const digest = await crypto.subtle.digest('SHA-1', whole);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
