import { z } from 'zod';

// ── Login ─────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El correo es obligatorio' })
    .email('Introduce un correo válido')
    .transform((v) => v.trim().toLowerCase()),
  password: z
    .string({ required_error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ── Activar cuenta ────────────────────────────────────────────────────────

export const activarCuentaSchema = z
  .object({
    cedula: z
      .string({ required_error: 'La cédula es obligatoria' })
      .min(4, 'Introduce tu número de documento')
      .transform((v) => v.trim()),
    email: z
      .string({ required_error: 'El correo es obligatorio' })
      .email('Introduce un correo válido')
      .transform((v) => v.trim().toLowerCase()),
    password: z
      .string({ required_error: 'La contraseña es obligatoria' })
      .min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z
      .string({ required_error: 'Confirma tu contraseña' })
      .min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type ActivarCuentaFormData = z.infer<typeof activarCuentaSchema>;

// ── Registro libre (marketplace) ──────────────────────────────────────────

export const registroSchema = z
  .object({
    nombre: z
      .string({ required_error: 'El nombre es obligatorio' })
      .min(1, 'El nombre es obligatorio')
      .transform((v) => v.trim()),
    apellido: z
      .string()
      .optional()
      .transform((v) => v?.trim() || undefined),
    email: z
      .string({ required_error: 'El correo es obligatorio' })
      .email('Introduce un correo válido')
      .transform((v) => v.trim().toLowerCase()),
    telefono: z
      .string({ required_error: 'El teléfono es obligatorio' })
      .min(7, 'Introduce un número de teléfono válido')
      .transform((v) => v.trim()),
    password: z
      .string({ required_error: 'La contraseña es obligatoria' })
      .min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z
      .string({ required_error: 'Confirma tu contraseña' })
      .min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegistroFormData = z.infer<typeof registroSchema>;

export const otpSchema = z.object({
  codigo: z
    .string({ required_error: 'El código es obligatorio' })
    .length(6, 'El código tiene 6 dígitos')
    .regex(/^\d{6}$/, 'Solo dígitos'),
});

export type OtpFormData = z.infer<typeof otpSchema>;
