import React, { useEffect, useState } from 'react';
import { View, Modal, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@api-client';
import type { GrupoTurno } from '@api-client';
import { Text, TextInput } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';
import { COLORS } from '@/lib/designTokens';
import { LugarInput } from '@/features/turnos/crear/LugarInput';
import { LugarAlias } from '@/features/turnos/crear/LugarAlias';
import { useActualizarGrupo } from './useGrupos';
import { cambiosDeGrupo, formularioDeGrupo } from './grupoUtils';

type Props = {
  visible: boolean;
  /** Grupo que se edita. */
  grupo: GrupoTurno;
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo. */
  etiqueta: string;
  onClose: () => void;
};

/** Editar un grupo: nombre, descripción y el lugar por defecto de sus turnos nuevos (con su nombre corto). */
export function EditarGrupoModal({ visible, grupo, etiqueta, onClose }: Props) {
  const actualizar = useActualizarGrupo();
  const [f, setF] = useState(() => formularioDeGrupo(grupo));
  const [errorNombre, setErrorNombre] = useState<string | undefined>();
  const [errorLugar, setErrorLugar] = useState<string | undefined>();
  const [repetido, setRepetido] = useState<string | null>(null);

  // Cada vez que se abre, parte de lo guardado: lo que se escribió y no se guardó no se arrastra.
  useEffect(() => {
    if (!visible) return;
    setF(formularioDeGrupo(grupo));
    setErrorNombre(undefined); setErrorLugar(undefined); setRepetido(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, grupo.id]);

  async function guardar() {
    setErrorNombre(undefined); setErrorLugar(undefined); setRepetido(null);
    const r = cambiosDeGrupo(f);
    if (!r.ok) {
      if (r.campo === 'nombre') setErrorNombre(r.mensaje); else setErrorLugar(r.mensaje);
      return;
    }
    try {
      await actualizar.mutateAsync({ id: grupo.id, payload: r.payload });
      showToast('Cambios guardados.');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // El mensaje del servidor dice "grupo": aquí se arma con el nombre, para que sirva con la etiqueta de la empresa.
        setRepetido(`Ya existe «${f.nombre.trim()}».`);
      } else {
        showAlert('No se pudo guardar', err instanceof ApiError ? err.message : 'Inténtalo de nuevo.');
      }
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-base font-bold text-foreground">{`Editar ${etiqueta}`}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerClassName="px-5 pb-8 gap-4" keyboardShouldPersistTaps="handled">
            <Input
              label="Nombre *"
              value={f.nombre}
              onChangeText={(t) => { setF((x) => ({ ...x, nombre: t })); setErrorNombre(undefined); setRepetido(null); }}
              maxLength={150}
              autoCapitalize="sentences"
              error={errorNombre ?? repetido ?? undefined}
            />

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Descripción (opcional)</Text>
              <TextInput
                accessibilityLabel="Descripción"
                value={f.descripcion}
                onChangeText={(t) => setF((x) => ({ ...x, descripcion: t }))}
                multiline
                numberOfLines={3}
                maxLength={5000}
                placeholder="Para qué es, quién lo pidió…"
                placeholderTextColor={COLORS.placeholder}
                className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground min-h-[84px]"
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Lugar (opcional)</Text>
              <LugarInput
                value={f.lugar}
                latitud={f.latitud}
                longitud={f.longitud}
                // Elegir otro lugar (con coordenadas) deja sin efecto el nombre corto del anterior.
                onChange={(l, lat, lng) => {
                  setF((x) => ({ ...x, lugar: l, latitud: lat, longitud: lng, ...(lat != null && l !== x.lugar ? { lugarAlias: '' } : {}) }));
                  setErrorLugar(undefined);
                }}
              />
              <LugarAlias
                lugar={f.lugar}
                latitud={f.latitud}
                longitud={f.longitud}
                alias={f.lugarAlias}
                onChange={(a) => setF((x) => ({ ...x, lugarAlias: a }))}
              />
              {errorLugar
                ? <Text className="text-xs text-danger">{errorLugar}</Text>
                : <Text className="text-xs text-muted-foreground">Es el lugar por defecto de los turnos nuevos. Los turnos que ya tiene no cambian.</Text>}
            </View>

            <Button label="Guardar cambios" size="lg" fullWidth loading={actualizar.isPending} onPress={guardar} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
