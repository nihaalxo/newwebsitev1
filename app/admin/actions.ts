'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cms, type CmsAdapter } from '@/lib/cms';
import { STALE_PROJECT_MESSAGE, type ProjectInput } from '@/lib/cms/types';
import { safeAdminPath } from '@/components/admin/auth';
import {
  SLUG_TAKEN_MESSAGE,
  errorCount,
  errorSummary,
  highlightLimitProblem,
  toInput,
  validateProject,
  validateSettings,
  type ActionResult,
  type SaveProjectResult,
  type SaveSettingsResult,
  type SettingsInput,
  type SignInState,
  type UploadTicketResult,
} from '@/components/admin/rules';
import { buildUploadPath, sanitizeProject, sanitizeSettings, uploadExtension } from '@/components/admin/sanitize';

// Every export here is a public POST endpoint. All of them except signIn confirm a signed-in admin first,
// and every write refreshes the whole site so the change shows up on the next visit.
// Signing out is a route handler instead (app/admin/signout/route.ts), so it's a full page load the
// unsaved-changes prompt can catch.

const SIGNED_OUT =
  'You have been signed out, so nothing was saved. Sign in again in a new tab, then come back here and try again.';

async function signedInStore(): Promise<CmsAdapter | null> {
  const store = await cms();
  return (await store.currentAdmin()) ? store : null;
}

function describeFailure(error: unknown, doing: string): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') return SIGNED_OUT;
  if (message === STALE_PROJECT_MESSAGE) return message;
  return message ? `Couldn't ${doing}: ${message}` : `Couldn't ${doing}. Try again in a moment.`;
}

function refreshSite() {
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------- auth

export async function signIn(_previous: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim().slice(0, 200);
  const password = String(form.get('password') ?? '').slice(0, 500);
  const next = safeAdminPath(form.get('next'));

  if (!email || !password) return { error: 'Enter your email and password.', email };

  try {
    const result = await (await cms()).signIn(email, password);
    if (!result.ok) return { error: result.error || "That email and password don't match. Check both and try again.", email };
  } catch (error) {
    return { error: describeFailure(error, 'sign in'), email };
  }

  redirect(next);
}

// ---------------------------------------------------------------- projects

/** `payload.expectedUpdatedAt` is the version the editor loaded; the store refuses the save if it has changed since. */
export async function saveProject(payload: ProjectInput): Promise<SaveProjectResult> {
  try {
    const store = await signedInStore();
    if (!store) return { ok: false, error: SIGNED_OUT, fieldErrors: {} };

    const sanitized = sanitizeProject(payload);
    if (!sanitized) return { ok: false, error: 'That save arrived empty. Reload the page and try again.', fieldErrors: {} };
    const { input, problems } = sanitized;

    const all = await store.listAll();
    const existing = input.id ? all.find((p) => p.id === input.id) : undefined;
    if (input.id && !existing) {
      return { ok: false, error: 'This project no longer exists. It may have been deleted in another tab.', fieldErrors: {} };
    }

    const publishing = input.status === 'published';
    const fieldErrors = { ...validateProject(input, publishing), ...problems };
    if (!fieldErrors.slug && all.some((p) => p.slug === input.slug && p.id !== input.id)) {
      fieldErrors.slug = SLUG_TAKEN_MESSAGE;
    }
    // Only turning it on is checked, so a project that's already highlighted can always be saved.
    if (input.featured && !existing?.featured) {
      const problem = highlightLimitProblem(all, input.id);
      if (problem) fieldErrors.featured = problem;
    }
    if (errorCount(fieldErrors) > 0) {
      return { ok: false, error: errorSummary(fieldErrors, publishing ? 'publishing' : 'saving'), fieldErrors };
    }

    // The project list owns the order: keep the stored position, and add new projects at the end.
    input.position = existing ? existing.position : all.reduce((max, p) => Math.max(max, p.position + 1), 0);

    const project = await store.saveProject(input);
    refreshSite();
    return { ok: true, project };
  } catch (error) {
    return { ok: false, error: describeFailure(error, 'save the project'), fieldErrors: {} };
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const store = await signedInStore();
    if (!store) return { ok: false, error: SIGNED_OUT };
    if (typeof id !== 'string' || !(await store.getById(id))) {
      return { ok: false, error: 'This project no longer exists. It may already have been deleted.' };
    }
    await store.deleteProject(id);
    refreshSite();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeFailure(error, 'delete the project') };
  }
}

/** `ids` is every project in its new order. */
export async function reorderProjects(ids: string[]): Promise<ActionResult> {
  try {
    const store = await signedInStore();
    if (!store) return { ok: false, error: SIGNED_OUT };

    const known = new Set((await store.listAll()).map((p) => p.id));
    const valid =
      Array.isArray(ids) &&
      ids.length === known.size &&
      new Set(ids).size === ids.length &&
      ids.every((id) => typeof id === 'string' && known.has(id));
    if (!valid) return { ok: false, error: 'The list changed somewhere else. Reload the page and try again.' };

    await store.reorder(ids);
    refreshSite();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeFailure(error, 'save the new order') };
  }
}

export async function setFeatured(id: string, featured: boolean): Promise<ActionResult> {
  try {
    const store = await signedInStore();
    if (!store) return { ok: false, error: SIGNED_OUT };
    const project = typeof id === 'string' ? await store.getById(id) : null;
    if (!project) return { ok: false, error: 'This project no longer exists. Reload the page.' };

    if (featured === true && !project.featured) {
      const problem = highlightLimitProblem(await store.listAll(), project.id);
      if (problem) return { ok: false, error: problem };
    }

    // This rewrites the whole record from the copy just read. If an editor save lands in between, the store
    // refuses this instead of undoing that save.
    await store.saveProject({ ...toInput(project), featured: featured === true, expectedUpdatedAt: project.updatedAt });
    refreshSite();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeFailure(error, 'change the home page') };
  }
}

// ---------------------------------------------------------------- settings

export async function saveSettings(payload: SettingsInput): Promise<SaveSettingsResult> {
  try {
    const store = await signedInStore();
    if (!store) return { ok: false, error: SIGNED_OUT, fieldErrors: {} };

    const input = sanitizeSettings(payload);
    if (!input) return { ok: false, error: 'That save arrived empty. Reload the page and try again.', fieldErrors: {} };

    const fieldErrors = validateSettings(input);
    if (errorCount(fieldErrors) > 0) return { ok: false, error: errorSummary(fieldErrors, 'saving'), fieldErrors };

    const settings = await store.saveSettings(input);
    refreshSite();
    return { ok: true, settings };
  } catch (error) {
    return { ok: false, error: describeFailure(error, 'save the settings'), fieldErrors: {} };
  }
}

// ---------------------------------------------------------------- uploads

/**
 * `hint` says where the file belongs ("projects/my-chaii/cover", "site/avatar"); the real path,
 * file name and extension are generated on the server.
 */
export async function createUploadTicket(hint: string, contentType: string): Promise<UploadTicketResult> {
  try {
    const store = await signedInStore();
    if (!store) return { ok: false, error: SIGNED_OUT };

    const extension = uploadExtension(contentType);
    if (!extension) {
      return {
        ok: false,
        error: "That file type isn't supported. Use JPG, PNG, WebP or GIF images, MP4, WebM or MOV video, or a PDF.",
      };
    }
    const path = buildUploadPath(hint, extension);
    if (!path) return { ok: false, error: "Couldn't work out where to store that file. Reload the page and try again." };

    return { ok: true, ticket: await store.createUpload(path, contentType) };
  } catch (error) {
    return { ok: false, error: describeFailure(error, 'start the upload') };
  }
}
