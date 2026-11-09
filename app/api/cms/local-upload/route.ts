import { NextResponse, type NextRequest } from 'next/server';
import { cms } from '@/lib/cms';
import { MAX_UPLOAD_BYTES, isAllowedUploadPath, isAllowedUploadType, uploadPathMatchesType } from '@/lib/cms/defaults';

// Receives files for local mode, writing them to public/uploads. Only exists under `npm run dev`: node:fs is imported
// inside the development-only branch, so a production build (and the Cloudflare Worker) never contains it.

export const dynamic = 'force-dynamic';

function reply(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status });
}

class TooLargeError extends Error {}

export async function PUT(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads');

    /** Streams the request body to `file`, stopping as soon as it passes the size limit. */
    const writeBody = async (body: ReadableStream<Uint8Array>, file: string): Promise<void> => {
      const handle = await fs.open(file, 'wx');
      const reader = body.getReader();
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_UPLOAD_BYTES) {
            await reader.cancel();
            throw new TooLargeError();
          }
          await handle.write(value);
        }
      } finally {
        await handle.close();
      }
    };

    const store = await cms();
    if (store.mode !== 'local') return reply(404, { error: 'Not found.' });
    if (!(await store.currentAdmin())) return reply(401, { error: 'Your session has ended. Sign in again to upload.' });

    const relativePath = request.nextUrl.searchParams.get('path') ?? '';
    if (!isAllowedUploadPath(relativePath)) return reply(400, { error: 'That upload path is not allowed.' });

    const contentType = request.headers.get('content-type') ?? '';
    if (!isAllowedUploadType(contentType)) return reply(415, { error: "That kind of file can't be uploaded." });
    // The extension decides how the file is served later, so it must be the one for the type just checked.
    if (!uploadPathMatchesType(relativePath, contentType)) {
      return reply(415, { error: "The file's type doesn't match its name." });
    }

    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_UPLOAD_BYTES) return reply(413, { error: 'Files can be at most 50 MB.' });
    if (!request.body) return reply(400, { error: 'The upload was empty.' });

    const target = path.join(UPLOADS_ROOT, relativePath);
    // The path pattern already rules out traversal; this is a second line of defence.
    if (!target.startsWith(UPLOADS_ROOT + path.sep)) return reply(400, { error: 'That upload path is not allowed.' });

    // An existing file is never replaced, so nothing already published changes under it.
    const exists = await fs.stat(target).then(
      () => true,
      () => false,
    );
    if (exists) return reply(409, { error: 'A file already exists at that path.' });

    await fs.mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.${Date.now()}.part`;
    try {
      await writeBody(request.body, temp);
      await fs.rename(temp, target);
    } catch (error) {
      await fs.rm(temp, { force: true });
      if (error instanceof TooLargeError) return reply(413, { error: 'Files can be at most 50 MB.' });
      throw error;
    }

    return NextResponse.json({ publicUrl: `/uploads/${relativePath}` });
  }

  return reply(404, { error: 'Not found.' });
}
