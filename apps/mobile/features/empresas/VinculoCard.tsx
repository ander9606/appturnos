import React from 'react';
import { View, Text, Image, Alert } from 'react-native';
import type { Vinculo } from '@api-client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { t } from '@/lib/i18n';

interface VinculoCardProps {
  vinculo: Vinculo;
  onAceptar?: (id: number) => void;
  onRechazar?: (id: number) => void;
  onArchivar?: (id: number) => void;
  onCancelar?: (id: number) => void;
  loadingId?: number | null;
}

const BADGE_VARIANT: Record<Vinculo['estado'], 'success' | 'warning' | 'info' | 'danger' | 'default'> = {
  activo:                   'success',
  solicitado_por_trabajador:'warning',
  solicitado_por_empresa:   'info',
  rechazado:                'danger',
  archivado:                'default',
};

export function VinculoCard({ vinculo, onAceptar, onRechazar, onArchivar, onCancelar, loadingId }: VinculoCardProps) {
  const { id, estado, empresa_nombre, empresa_logo, empresa_ciudad } = vinculo;
  const iniciales = empresa_nombre.slice(0, 2).toUpperCase();
  const isLoading = loadingId === id;

  const handleArchivar = () => {
    Alert.alert(
      t('empresas.desvincular'),
      `¿Deseas desvincularte de ${empresa_nombre}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('empresas.desvincular'), style: 'destructive', onPress: () => onArchivar?.(id) },
      ],
    );
  };

  return (
    <View
      className="bg-card rounded-2xl px-4 py-3 mb-3 overflow-hidden"
      style={{ elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />

      <View className="flex-row items-center gap-3 ml-2">
        {empresa_logo ? (
          <Image source={{ uri: empresa_logo }} className="w-12 h-12 rounded-xl" resizeMode="contain" />
        ) : (
          <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center">
            <Text className="text-primary-600 text-sm font-bold">{iniciales}</Text>
          </View>
        )}

        <View className="flex-1">
          <Text className="text-foreground font-semibold text-sm" numberOfLines={1}>{empresa_nombre}</Text>
          {empresa_ciudad ? (
            <Text className="text-muted-foreground text-xs mt-0.5">{empresa_ciudad}</Text>
          ) : null}
          <Badge
            label={t(`empresas.estados.${estado}` as any)}
            variant={BADGE_VARIANT[estado]}
            size="sm"
          />
        </View>
      </View>

      {estado === 'solicitado_por_empresa' && (
        <View className="flex-row gap-2 mt-3 ml-2">
          <Button
            label={t('empresas.aceptar')}
            variant="success"
            size="sm"
            onPress={() => onAceptar?.(id)}
            loading={isLoading}
          />
          <Button
            label={t('empresas.rechazar')}
            variant="ghost"
            size="sm"
            onPress={() => onRechazar?.(id)}
            disabled={isLoading}
          />
        </View>
      )}

      {estado === 'solicitado_por_trabajador' && (
        <View className="mt-3 ml-2">
          <Button
            label={t('empresas.cancelarSolicitud')}
            variant="ghost"
            size="sm"
            onPress={() => onCancelar?.(id)}
            loading={isLoading}
          />
        </View>
      )}

      {estado === 'activo' && onArchivar && (
        <View className="mt-3 ml-2">
          <Button
            label={t('empresas.desvincular')}
            variant="ghost"
            size="sm"
            onPress={handleArchivar}
            loading={isLoading}
          />
        </View>
      )}
    </View>
  );
}
