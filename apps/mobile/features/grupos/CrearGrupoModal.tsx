import React, { useState } from 'react';
import { View, Modal, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, gruposTurnoApi } from '@api-client';
import type { GrupoTurno } from '@api-client';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { showAlert } from '@/lib/alertDialog';
import { COLORS } from '@/lib/designTokens';
import { LugarInput } from '@/features/turnos/crear/LugarInput';
import { useCrearGrupo } from './useGrupos';

type Props = {
  visible: boolean;
  /** Cómo llama la empresa a un grupo ("Evento", "Obra"…): va de título, sin artículo, para que sirva con cualquier nombre. */
  etiqueta: string;
  /** Se llama con el grupo recién creado, o con el que ya existía si el usuario elige "Usar ese". */
  onCreado: (g: GrupoTurno) => void;
  onClose: () => void;
};

/** Crear un grupo desde el formulario del turno: solo el nombre es obligatorio. */
export function CrearGrupoModal({ visible, etiqueta, onCreado, onClose }: Props) {
  const crear = useCrearGrupo();
  const [nombre, setNombre] = useState('');
  const [lugar, setLugar] = useState('');
  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);
  const [errorNombre, setErrorNombre] = useState<string | undefined>();
  const [errorLugar, setErrorLugar] = useState<string | undefined>();
  // Nombre repetido: el servidor trae el id del que ya lo usa, para ofrecer "Usar ese".
  const [repetido, setRepetido] = useState<{ id: number | null; mensaje: string } | null>(null);

  const reiniciar = () => {
    setNombre(''); setLugar(''); setLatitud(null); setLongitud(null);
    setErrorNombre(undefined); setErrorLugar(undefined); setRepetido(null);
  };
  const cerrar = () => { reiniciar(); onClose(); };

  async function guardar() {
    const limpio = nombre.trim();
    setErrorNombre(undefined); setErrorLugar(undefined); setRepetido(null);
    if (!limpio) { setErrorNombre('Escribe un nombre.'); return; }
    // El servidor pide dirección y coordenadas juntas; escribir a mano borra las coordenadas.
    const conLugar = lugar.trim() !== '';
    if (conLugar && (latitud == null || longitud == null)) {
      setErrorLugar('Elige una dirección de la lista, o deja el lugar vacío.');
      return;
    }
    try {
      const grupo = await crear.mutateAsync({
        nombre: limpio,
        ...(conLugar ? { lugar: lugar.trim(), latitud: latitud!, longitud: longitud! } : {}),
      });
      reiniciar();
      onCreado(grupo);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setRepetido({ id: err.detalles?.[0]?.grupo_id ?? null, mensaje: err.message });
      } else {
        showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo crear.');
      }
    }
  }

  async function usarExistente() {
    if (!repetido?.id) return;
    try {
      const existente = await gruposTurnoApi.obtener(repetido.id);
      reiniciar();
      onCreado(existente);
    } catch {
      showAlert('Error', 'No se pudo cargar. Intenta de nuevo.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={cerrar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-base font-bold text-foreground">{`Crear ${etiqueta}`}</Text>
            <TouchableOpacity onPress={cerrar} accessibilityRole="button" accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerClassName="px-5 pb-8 gap-4" keyboardShouldPersistTaps="handled">
            <Input
              label="Nombre *"
              placeholder="Ej.: Feria del Libro 2026"
              value={nombre}
              onChangeText={(t) => { setNombre(t); setErrorNombre(undefined); setRepetido(null); }}
              maxLength={150}
              autoCapitalize="sentences"
              error={errorNombre}
            />

            {repetido && (
              <View className="bg-warning-light border border-warning rounded-2xl px-4 py-3 gap-2">
                <Text className="text-sm text-foreground">{repetido.mensaje}</Text>
                {repetido.id != null && <Button label="Usar ese" variant="secondary" size="sm" onPress={usarExistente} />}
              </View>
            )}

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-foreground">Lugar (opcional)</Text>
              <LugarInput
                value={lugar}
                latitud={latitud}
                longitud={longitud}
                onChange={(l, lat, lng) => { setLugar(l); setLatitud(lat); setLongitud(lng); setErrorLugar(undefined); }}
              />
              {errorLugar
                ? <Text className="text-xs text-danger">{errorLugar}</Text>
                : <Text className="text-xs text-muted-foreground">Los turnos nuevos usarán este lugar por defecto; podrás cambiarlo en cada turno.</Text>}
            </View>

            <Button label="Crear y usar" size="lg" fullWidth onPress={guardar} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
