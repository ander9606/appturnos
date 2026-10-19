import { COLORS } from '@/lib/designTokens';
import type { IconName } from './Icon';

export type FeedbackVariant = 'error' | 'warning' | 'info' | 'success';

/**
 * Look de cada tipo de aviso (diálogos y toasts). `bg` va como clase literal para que
 * NativeWind la detecte al compilar; `color` es el del ícono.
 */
export const FEEDBACK: Record<FeedbackVariant, { icon: IconName; color: string; bg: string }> = {
  error:   { icon: 'alert-circle',       color: COLORS.danger,      bg: 'bg-danger-light' },
  warning: { icon: 'warning',            color: COLORS.warningDark, bg: 'bg-warning-light' },
  info:    { icon: 'information-circle', color: COLORS.info,        bg: 'bg-info-light' },
  success: { icon: 'checkmark-circle',   color: COLORS.success,     bg: 'bg-success-light' },
};
