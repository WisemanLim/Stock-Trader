const ACCOUNT_KEY = 'st_account';
export const DEFAULT_ACCOUNT = 'default';

export function getAccount(): string {
  try {
    return localStorage.getItem(ACCOUNT_KEY) || DEFAULT_ACCOUNT;
  } catch {
    return DEFAULT_ACCOUNT;
  }
}

export function setStoredAccount(name: string): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, name);
    window.dispatchEvent(new StorageEvent('storage', { key: ACCOUNT_KEY, newValue: name }));
  } catch {}
}
