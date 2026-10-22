import React from 'react';
import { Controller, type Control } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import type { FormData } from './miEmpresaForm';

type NombreCampo = 'nombre' | 'nit' | 'representante_nombre' | 'representante_cedula' | 'actividad' | 'ciudad' | 'descripcion';

/** Campo de texto del formulario de la empresa: enlaza `Input` con react-hook-form y muestra su error. */
export function CampoEmpresa({ control, name, error, ...inputProps }: {
  control: Control<FormData>;
  name: NombreCampo;
  error?: string;
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChangeText' | 'onBlur' | 'error'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input {...inputProps} value={value} onChangeText={onChange} onBlur={onBlur} error={error} />
      )}
    />
  );
}
