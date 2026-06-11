import React from 'react';
import { View, Text, Image } from 'react-native';
import type { EmpresaDirectorio } from '@api-client';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { t } from '@/lib/i18n';

type EstadoVinculoSimple = 'activo' | 'pendiente' | 'invitacion' | null;

interface EmpresaCardProps {
  empresa: EmpresaDirectorio;
  estadoVinculo?: EstadoVinculoSimple;
  onSolicitar: () => void;
  solicitando?: boolean;
}

export function EmpresaCard({ empresa, estadoVinculo, onSolicitar, solicitando }: EmpresaCardProps) {
  const iniciales = empresa.nombre.slice(0, 2).toUpperCase();

  return (
    <View
      className="bg-card rounded-2xl px-4 py-3 mb-3 flex-row items-center gap-3 overflow-hidden"
      style={{ elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 }}
    >
      <View className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />

      {empresa.logo_url ? (
        <Image source={{ uri: empresa.logo_url }} className="w-12 h-12 rounded-xl ml-2" resizeMode="contain" />
      ) : (
        <View className="w-12 h-12 rounded-xl bg-primary-50 items-center justify-center ml-2">
          <Text className="text-primary-600 text-sm font-bold">{iniciales}</Text>
        </View>
      )}

      <View className="flex-1">
        <Text className="text-foreground font-semibold text-sm" numberOfLines={1}>{empresa.nombre}</Text>
        {empresa.ciudad ? (
          <Text className="text-muted-foreground text-xs mt-0.5">{empresa.ciudad}</Text>
        ) : null}
        {empresa.descripcion ? (
          <Text className="text-muted-foreground text-xs mt-0.5" numberOfLines={1}>{empresa.descripcion}</Text>
        ) : null}
      </View>

      {estadoVinculo === 'activo' ? (
        <Badge label={t('empresas.estados.activo')} variant="success" size="sm" />
      ) : estadoVinculo === 'pendiente' ? (
        <Badge label={t('empresas.estados.solicitado_por_trabajador')} variant="warning" size="sm" />
      ) : (
        <Button
          label={t('empresas.solicitar')}
          variant="primary"
          size="sm"
          onPress={onSolicitar}
          loading={solicitando}
        />
      )}
    </View>
  );
}
