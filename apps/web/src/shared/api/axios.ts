import axios from 'axios';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

type AuthSnapshot = {
  accessToken: string | null;
  refreshToken: string | null;
  clearAuth: () => void;
  setTokens: (a: string, r: string) => void;
};

let getAuth: (() => AuthSnapshot) | null = null;
export function configureAuth(fn: () => AuthSnapshot) {
  getAuth = fn;
}

api.interceptors.request.use(cfg => {
  const token = getAuth?.().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  async (err: unknown) => {
    if (!axios.isAxiosError(err)) return Promise.reject(err);
    const original = err.config as typeof err.config & { _retry?: boolean };
    if (err.response?.status !== 401 || original?._retry) return Promise.reject(err);
    if (!original) return Promise.reject(err);
    original._retry = true;

    const auth = getAuth?.();
    if (!auth?.refreshToken) {
      auth?.clearAuth();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(token => {
        original.headers.set('Authorization', `Bearer ${token}`);
        return api(original);
      });
    }

    isRefreshing = true;
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/auth/refresh`,
        { refresh_token: auth.refreshToken }
      );
      const newToken: string = data.data.access_token;
      auth.setTokens(newToken, auth.refreshToken!);
      processQueue(null, newToken);
      original.headers.set('Authorization', `Bearer ${newToken}`);
      return api(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      auth?.clearAuth();
      window.location.href = '/login';
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
