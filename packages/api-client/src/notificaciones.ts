import { api } from './client';

export const notificacionesApi = {
  registrarExpoToken(token: string): Promise<null> {
    return api.post<null>('/api/push/expo-token', { token });
  },

  desregistrarExpoToken(token: string): Promise<null> {
    return api.delete<null>('/api/push/expo-token', { token });
  },
};
