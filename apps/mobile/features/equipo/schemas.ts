import { z } from 'zod';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Optional positive number — empty string treated as undefined */
const optionalPositiveNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === '' || v === undefined || v === null) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  })
  .refine((v) => v === undefined || v >= 0, { message: 'Debe ser ≥ 0' });

// ── Schema ────────────────────────────────────────────────────────────────

export const trabajadorSchema = z
  .object({
    nombre:       z.string().trim().min(1, 'El nombre es obligatorio'),
    apellido:     z.string().trim().min(1, 'El apellido es obligatorio'),
    tipo:         z.enum(['turnos', 'nomina', 'ambos']),
    cedula:       z.string().trim().optional().or(z.literal('')),
    email:        z.string().trim().email('Email inválido').optional().or(z.literal('')),
    telefono:     z.string().trim().optional().or(z.literal('')),
    cargo:        z.string().trim().optional().or(z.literal('')),
    tarifa_hora:  optionalPositiveNumber,
    salario_base: optionalPositiveNumber,
  })
  .refine(
    (d) =>
      // At least one of tarifa_hora or salario_base, or neither (allowed)
      true,
  );

export type TrabajadorFormValues = z.infer<typeof trabajadorSchema>;

export const TIPO_OPTIONS: { value: TrabajadorFormValues['tipo']; label: string }[] = [
  { value: 'turnos', label: 'Turnos'  },
  { value: 'nomina', label: 'Nómina'  },
  { value: 'ambos',  label: 'Ambos'   },
];
