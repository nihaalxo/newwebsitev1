import { fileStore } from '@/lib/admin-api/file-store';
import { handleAdminApi } from '@/lib/admin-api/handler';

// The admin's API under `npm run dev` only (the .dev.ts extension is a page only in development, next.config.ts):
// the same handler as the Worker, with drafts in .drafts/, uploads in public/uploads/p/ and publishing into content/.

export const dynamic = 'force-dynamic';

const handle = (request: Request) => handleAdminApi(request, fileStore());

export { handle as DELETE, handle as GET, handle as HEAD, handle as POST, handle as PUT };
