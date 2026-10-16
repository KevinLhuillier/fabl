import type {
  AdminUser,
  AnalysisReport,
  ApiError,
  Level,
  ServerStatus,
  StoryDetail,
  StoryListItem,
  TranslationInput,
} from '../../shared/api';

/** Called when the session is gone (expired, signed out elsewhere, admin revoked). */
let onSignedOut: () => void = () => {};
export const setSignedOutHandler = (fn: () => void) => (onSignedOut = fn);

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  const res = await fetch(`/api${url}`, init);
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({ error: res.statusText }))) as T | ApiError;
  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && !url.startsWith('/auth/')) onSignedOut();
    throw new Error((data as ApiError).error ?? res.statusText);
  }
  return data as T;
}

const story = (slug: string) => `/stories/${encodeURIComponent(slug)}`;

export const api = {
  status: () => request<ServerStatus>('GET', '/status'),
  me: () => request<AdminUser>('GET', '/auth/me'),
  signIn: (email: string, password: string) =>
    request<AdminUser>('POST', '/auth/login', { email, password }),
  signOut: () => request<void>('POST', '/auth/logout'),
  stories: () => request<StoryListItem[]>('GET', '/stories'),
  story: (slug: string) => request<StoryDetail>('GET', story(slug)),
  create: (slug: string, title: string, level: Level) =>
    request<StoryDetail>('POST', '/stories', { slug, title, level }),
  save: (slug: string, source: string) => request<StoryDetail>('PUT', story(slug), { source }),
  remove: (slug: string, opts: { file: boolean; online: boolean }) =>
    request<void>(
      'DELETE',
      `${story(slug)}?file=${opts.file ? 1 : 0}&online=${opts.online ? 1 : 0}`,
    ),
  importFile: (slug: string) => request<StoryDetail>('POST', `${story(slug)}/import`),
  check: (slug: string) => request<AnalysisReport>('POST', `${story(slug)}/check`),
  publish: (slug: string) => request<AnalysisReport>('POST', `${story(slug)}/publish`),
  uploadCover: (slug: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string }>('POST', `${story(slug)}/cover`, form);
  },
  saveTranslations: (entries: TranslationInput[]) =>
    request<{ saved: number; online: boolean }>('POST', '/translations', { entries }),
};
