const TOKEN_KEY = 'st_token';
const USER_KEY = 'st_user';
const REMEMBER_KEY = 'st_remember_id';
const SAVED_EMAIL_KEY = 'st_saved_email';
const AUTO_LOGIN_KEY = 'st_auto_login';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  initial_cash: number;
}

// autologin=true → localStorage(영속). false → sessionStorage(탭 종료 시 삭제).
export function storeSession(token: string, user: SessionUser, autologin = true): void {
  const store = autologin ? localStorage : sessionStorage;
  store.setItem(TOKEN_KEY, token);
  store.setItem(USER_KEY, JSON.stringify(user));
  // 반대쪽 store 잔여 항목 정리
  if (autologin) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  [localStorage, sessionStorage].forEach(s => {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  });
}

export function isLoggedIn(): boolean {
  return !!(localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY));
}

export function updateStoredUser(patch: Partial<SessionUser>): void {
  const user = getStoredUser();
  if (!user) return;
  const store = localStorage.getItem(USER_KEY) ? localStorage : sessionStorage;
  store.setItem(USER_KEY, JSON.stringify({ ...user, ...patch }));
}

// ── 아이디 기억하기 ─────────────────────────────────────
export function saveRememberEmail(email: string): void {
  localStorage.setItem(REMEMBER_KEY, 'true');
  localStorage.setItem(SAVED_EMAIL_KEY, email);
}

export function clearRememberEmail(): void {
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem(SAVED_EMAIL_KEY);
}

export function getRememberedEmail(): string | null {
  if (localStorage.getItem(REMEMBER_KEY) !== 'true') return null;
  return localStorage.getItem(SAVED_EMAIL_KEY);
}

// ── 자동로그인 설정 저장 ────────────────────────────────
export function saveAutoLoginPref(on: boolean): void {
  localStorage.setItem(AUTO_LOGIN_KEY, on ? 'true' : 'false');
}

export function getAutoLoginPref(): boolean {
  return localStorage.getItem(AUTO_LOGIN_KEY) !== 'false'; // 기본 true
}
