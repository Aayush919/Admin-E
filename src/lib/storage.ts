const TOKEN_KEY = 'admin_e_token';
const SITE_TAG_KEY = 'admin_e_site_tag';
const USER_KEY = 'admin_e_user';

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>;

/** Default tenant tag for API requests (override with VITE_SITE_TAG). */
export function getDefaultSiteTag(): string {
  return env.VITE_SITE_TAG ?? 'w1';
}

/** Stored login site tag, or env/default — used for every API request header. */
export function resolveSiteTag(): string {
  return localStorage.getItem(SITE_TAG_KEY) ?? getDefaultSiteTag();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getSiteTag() {
  return localStorage.getItem(SITE_TAG_KEY);
}

export function setSiteTag(siteTag: string) {
  localStorage.setItem(SITE_TAG_KEY, siteTag);
}

export function clearSiteTag() {
  localStorage.removeItem(SITE_TAG_KEY);
}

export function getUser<T>() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw || raw === 'undefined' || raw === 'null') {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setUser(user: unknown) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export function clearSession() {
  clearToken();
  clearSiteTag();
  clearUser();
}
