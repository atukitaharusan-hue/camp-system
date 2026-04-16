export const ADMIN_EVENTS_KEY = 'admin-events-config';
export const ADMIN_OPTIONS_KEY = 'admin-options-config';
export const ADMIN_POLICIES_KEY = 'admin-policies-config';
export const ADMIN_PLANS_KEY = 'admin-plans-config';
export const ADMIN_SITES_KEY = 'admin-sites-config';
export const ADMIN_MEMBERS_KEY = 'admin-members-config';
export const ADMIN_INVITES_KEY = 'admin-member-invites';
export const ADMIN_ACCOUNT_KEY = 'admin-account-config';
export const ADMIN_QR_SCREEN_KEY = 'admin-qr-screen-config';
export const ADMIN_SETUP_STATE_KEY = 'admin-setup-state';
export const ADMIN_RULES_KEY = 'admin-rules-config';
export const ADMIN_SITE_MAP_KEY = 'admin-site-map-config';
export const ADMIN_CONFIG_UPDATED_EVENT = 'admin-config-updated';

export function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(ADMIN_CONFIG_UPDATED_EVENT, { detail: { key } }));
}

export function removeJsonStorage(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
}
