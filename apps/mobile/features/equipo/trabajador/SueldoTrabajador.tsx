import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import React, { useState } from 'react';
import { View, Pressable, Modal } from 'react-native';
import { showToast } from '@/lib/toast';
import { useActualizarSalario, useHistorialSalario } from '@/features/equipo/useEquipo';
import { ApiError } from '@api-client';
import type { Trabajador } from '@api-client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { fmtCopOpt } from './fichaTrabajadorUtils';

/** Estado y acciones del modal "Editar sueldo". */
export function useEditarSueldo(numId: number, t: Trabajador | undefined) {
  const actualizarSalario = useActualizarSalario(numId);
  const [salarioModal, setSalarioModal] = useState(false);
  const [tarifaInput,  setTarifaInput]  = useState('');
  const [salarioInput, setSalarioInput] = useState('');
  const [salarioError, setSalarioError] = useState<string | null>(null);

  function abrirSalario() {
    setTarifaInput(t?.tarifa_hora != null ? String(t.tarifa_hora) : '');
    setSalarioInput(t?.salario_base != null ? String(t.salario_base) : '');
    setSalarioError(null);
    setSalarioModal(true);
  }

  async function guardarSalario() {
    const parse = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
    const tarifa = parse(tarifaInput);
    const salario = parse(salarioInput);
    const invalido = (n: number | null) => n !== null && (!Number.isFinite(n) || n < 0);
    if (invalido(tarifa) || invalido(salario)) {
      setSalarioError('Ingresa valores numéricos mayores o iguales a 0.');
      return;
    }
    try {
      await actualizarSalario.mutateAsync({ tarifa_hora: tarifa, salario_base: salario });
      setSalarioModal(false);
      showToast('Sueldo actualizado.');
    } catch (err: unknown) {
      setSalarioError(err instanceof ApiError ? err.message : 'No se pudo guardar el sueldo.');
    }
  }

  return {
    salarioModal, setSalarioModal, tarifaInput, setTarifaInput, salarioInput, setSalarioInput,
    salarioError, abrirSalario, guardarSalario, guardando: actualizarSalario.isPending,
  };
}

type Editor = ReturnType<typeof useEditarSueldo>;

/** Fila "Sueldo" con el acceso a editarlo — jefe_nomina y admin. */
export function FilaSueldo({ onEditar }: { onEditar: () => void }) {
  return (
    <View className="mx-4 mt-3 bg-card rounded-2xl border border-border px-4 py-3 flex-row items-center justify-between">
      <Text className="text-sm text-muted-foreground">Sueldo</Text>
      <Pressable onPress={onEditar} hitSlop={8} accessibilityRole="button" className="active:opacity-70">
        <Text className="text-sm font-semibold text-primary">Editar sueldo</Text>
      </Pressable>
    </View>
  );
}

export function ModalSueldo({ e }: { e: Editor }) {
  return (
    <Modal visible={e.salarioModal} transparent animationType="fade" onRequestClose={() => e.setSalarioModal(false)}>
      <View className="flex-1 bg-black/40 items-center justify-center px-6">
        <View className="w-full bg-card rounded-2xl p-5 gap-4">
          <Text className="text-base font-semibold text-foreground">Editar sueldo</Text>
          <Input
            label="Tarifa por hora (COP)"
            keyboardType="decimal-pad"
            value={e.tarifaInput}
            onChangeText={e.setTarifaInput}
          />
          <Input
            label="Salario base mensual (COP)"
            keyboardType="decimal-pad"
            value={e.salarioInput}
            onChangeText={e.setSalarioInput}
            error={e.salarioError ?? undefined}
          />
          <Text className="text-xs text-muted-foreground">
            Deja vacío para quitar el valor. Los períodos de nómina ya cerrados no cambian.
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => e.setSalarioModal(false)}
              className="flex-1 h-12 rounded-xl items-center justify-center border border-border active:opacity-70"
            >
              <Text className="text-foreground font-semibold">Cancelar</Text>
            </Pressable>
            <View className="flex-1">
              <Button label="Guardar" onPress={e.guardarSalario} loading={e.guardando} fullWidth />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function HistorialSueldo({ numId, habilitado }: { numId: number; habilitado: boolean }) {
  const historialSalario = useHistorialSalario(numId, habilitado);
  if (!habilitado) return null;
  return (
    <View className="mx-4 mt-3 bg-card rounded-2xl border border-border p-4 gap-3">
      <View className="gap-0.5">
        <Text className="text-sm font-semibold text-foreground">Historial de sueldo</Text>
        <Text className="text-xs text-muted-foreground">Registro de auditoría. No se puede editar ni borrar.</Text>
      </View>
      {historialSalario.isLoading ? (
        <Spinner />
      ) : (historialSalario.data ?? []).length === 0 ? (
        <EmptyState compact title="Sin cambios registrados." />
      ) : (
        (historialSalario.data ?? []).map((c) => (
          <View key={c.id} className="border-t border-border/60 pt-2 gap-0.5">
            <Text className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' '}{new Date(c.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{c.usuario_nombre} ({c.usuario_rol})
            </Text>
            <Text className="text-sm text-foreground">Tarifa/h: {fmtCopOpt(c.tarifa_hora_anterior)} → {fmtCopOpt(c.tarifa_hora_nueva)}</Text>
            <Text className="text-sm text-foreground">Salario: {fmtCopOpt(c.salario_base_anterior)} → {fmtCopOpt(c.salario_base_nueva)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
