import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { configureAuth } from '@/shared/api/axios';

export type Rol = 'super_admin' | 'admin_empresa' | 'jefe_nomina' | 'jefe_turnos' | 'nomina';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  empresa_id: number;
}

interface AuthStore {
  usuario: Usuario | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (usuario: Usuario, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      usuario: null,
      accessToken: null,
      refreshToken: null,
      login: (usuario, accessToken, refreshToken) => set({ usuario, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearAuth: () => set({ usuario: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'zaturno-auth' }
  )
);

configureAuth(() => ({
  accessToken: useAuthStore.getState().accessToken,
  refreshToken: useAuthStore.getState().refreshToken,
  clearAuth: useAuthStore.getState().clearAuth,
  setTokens: useAuthStore.getState().setTokens,
}));
