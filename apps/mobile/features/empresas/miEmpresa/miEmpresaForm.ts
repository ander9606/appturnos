import { z } from 'zod';

export const schema = z.object({
  nombre:               z.string().trim().min(1, 'Razón social requerida'),
  nit:                  z.string().trim().optional(),
  representante_nombre: z.string().trim().optional(),
  representante_cedula: z.string().trim().optional(),
  ciudad:               z.string().trim().optional(),
  actividad:            z.string().trim().optional(),
  descripcion:          z.string().trim().optional(),
  // Ya no se tipea a mano — se sube por cámara/galería (data URI) o queda como URL externa preexistente.
  logo_url:             z.string().optional().or(z.literal('')),
  acepta_postulaciones: z.boolean(),
  tipo_liquidacion:     z.enum(['mensual', 'quincenal', 'semanal']),
  tipo_contrato:        z.enum(['laboral', 'prestacion_servicios']),
  sumar_nocturnas_festivo: z.boolean(),
  regla_domingo_habitual:  z.enum(['ley', 'dos_meses']),
});

export type FormData = z.infer<typeof schema>;
