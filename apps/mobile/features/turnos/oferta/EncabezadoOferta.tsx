import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/lib/designTokens';
import type { OfertaDetalle } from '@api-client';
import { DuplicarOfertaModal } from './DuplicarOfertaModal';
import { EditarOfertaModal } from './EditarOfertaModal';

/** Título de la pantalla y, para el gestor, los botones de editar y duplicar con sus modales. */
export function EncabezadoOferta({ oferta, puedeGestionar, ofertaEsEditable }: {
  oferta: OfertaDetalle;
  puedeGestionar: boolean;
  ofertaEsEditable: boolean;
}) {
  const [showDuplicarModal, setShowDuplicarModal] = useState(false);
  const [showEditarOfertaModal, setShowEditarOfertaModal] = useState(false);

  return (
    <>
      <Stack.Screen
        options={{
          title: oferta.titulo,
          headerShown: true,
          headerRight: puedeGestionar ? () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {ofertaEsEditable && (
                <TouchableOpacity
                  onPress={() => setShowEditarOfertaModal(true)}
                  hitSlop={10}
                  accessibilityLabel="Editar turno"
                >
                  <Ionicons name="create-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowDuplicarModal(true)}
                hitSlop={10}
                accessibilityLabel="Duplicar oferta"
                style={{ marginRight: 4 }}
              >
                <Ionicons name="copy-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : undefined,
        }}
      />

      <DuplicarOfertaModal
        visible={showDuplicarModal}
        oferta={oferta}
        onClose={() => setShowDuplicarModal(false)}
      />

      <EditarOfertaModal
        visible={showEditarOfertaModal}
        oferta={oferta}
        onClose={() => setShowEditarOfertaModal(false)}
      />
    </>
  );
}
