import { api } from '@/shared/api/axios';

export const integracionApi = {
  getEstado: () =>
    api.get('/integracion/estado').then(r => r.data),

  getConfig: () =>
    api.get('/integracion/configuracion').then(r => r.data),

  updateConfig: (data: { activo?: boolean; webhook_url?: string }) =>
    api.put('/integracion/configuracion', data).then(r => r.data),

  emparejar: (codigo: string) =>
    api.post('/integracion/emparejar', { codigo }).then(r => r.data),

  getConciliacion: () =>
    api.get('/integracion/conciliacion').then(r => r.data),

  vincular: (trabajador_id: number, empleado_id: number) =>
    api.post('/integracion/conciliacion/vincular', { trabajador_id, empleado_id }).then(r => r.data),
};
