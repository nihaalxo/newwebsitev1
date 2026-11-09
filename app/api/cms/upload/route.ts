import { NextResponse, type NextRequest } from 'next/server';
import { cms } from '@/lib/cms';
import { R2_PREFIX, R2_PUBLIC_PREFIX, cloudflareEnv } from '@/lib/cms/cloudflare-env';
import {
  MAX_PDF_BYTES,
  MAX_UPLOAD_BYTES,
  isAllowedUploadPath,
  isAllowedUploadType,
  uploadPathMatchesType,
} from '@/lib/cms/defaults';

// Receives the admin's uploads on Cloudflare and writes them to R2 (binding CMS_UPLOADS). The admin gets this URL
// from createUpload in lib/cms/cloudflare.ts; app/cms/[...path]/route.ts serves the files back at /cms/<path>.

export const dynamic = 'force-dynamic';

function reply(status: number, body: Record<string, string>) {
  return NextResponse.json(body, { status });
}

const megabytes = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

export async function PUT(request: NextRequest) {
  const env = cloudflareEnv();
  if (!env) return reply(404, { error: 'Not found.' });

  const store = await cms();
  if (store.mode !== 'cloudflare') return reply(404, { error: 'Not found.' });
  if (!(await store.currentAdmin())) return reply(401, { error: 'Your session has ended. Sign in again to upload.' });

  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!isAllowedUploadPath(path)) return reply(400, { error: 'That upload path is not allowed.' });

  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!isAllowedUploadType(contentType)) return reply(415, { error: "That kind of file can't be uploaded." });
  // The extension decides how the file is served later, so it must be the one for the type just checked.
  if (!uploadPathMatchesType(path, contentType)) return reply(415, { error: "The file's type doesn't match its name." });

  const limit = contentType === 'application/pdf' ? MAX_PDF_BYTES : MAX_UPLOAD_BYTES;
  const tooLarge = () => reply(413, { error: `Files like this can be at most ${megabytes(limit)}.` });
  if (Number(request.headers.get('content-length') ?? 0) > limit) return tooLarge();

  const key = `${R2_PREFIX}${path}`;
  // An existing file is never replaced: it is cached for a year, so a replaced file would keep showing the old one.
  if (await env.CMS_UPLOADS.head(key)) return reply(409, { error: 'A file already exists at that path.' });

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return reply(400, { error: 'The upload was empty.' });
  if (body.byteLength > limit) return tooLarge();

  await env.CMS_UPLOADS.put(key, body, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });
  return NextResponse.json({ publicUrl: `${R2_PUBLIC_PREFIX}${path}` });
}
