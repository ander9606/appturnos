import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';

export default function TerminosScreen() {
  const router  = useRouter();
  const theme   = useTheme();
  const usuario = useAuthStore((s) => s.usuario);
  const rehydrate = useAuthStore((s) => s.rehydrate);
  const [scrolled, setScrolled] = useState(false);
  const yaAceptados = !!usuario?.terminos_aceptados_at;

  const aceptar = useMutation({
    mutationFn: () => authApi.aceptarTerminos(),
    onSuccess: async () => {
      await rehydrate();
      router.replace('/(tabs)');
    },
    onError: () => Alert.alert('Error', 'No se pudo registrar la aceptación. Intenta de nuevo.'),
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <View className="px-6 pt-6 pb-4">
          <Text className="text-2xl font-bold text-foreground">Términos y condiciones</Text>
          <Text className="text-sm text-muted-foreground mt-1">Lee el acuerdo completo antes de continuar.</Text>
        </View>

        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 40) {
              setScrolled(true);
            }
          }}
          scrollEventThrottle={16}
        >
          <Text className="text-sm text-foreground leading-6">
            {TERMINOS_TEXT}
          </Text>
          <View className="h-8" />
        </ScrollView>

        <View className="px-6 py-4 border-t border-border gap-3">
          {yaAceptados ? (
            <Button
              label="Volver"
              variant="primary"
              fullWidth
              onPress={() => router.back()}
            />
          ) : (
            <>
              {!scrolled && (
                <Text className="text-xs text-center text-muted-foreground">
                  Desplázate hasta el final para aceptar
                </Text>
              )}
              <Button
                label={aceptar.isPending ? 'Aceptando…' : 'Acepto los términos y condiciones'}
                variant="primary"
                fullWidth
                loading={aceptar.isPending}
                disabled={!scrolled}
                onPress={() => aceptar.mutate()}
              />
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const TERMINOS_TEXT = `TÉRMINOS Y CONDICIONES DE USO — ZATURNO

Fecha de vigencia: 1 de julio de 2026

1. ACEPTACIÓN
Al usar la aplicación Zaturno aceptas estos términos en su totalidad. Si no estás de acuerdo, no uses la aplicación.

2. DESCRIPCIÓN DEL SERVICIO
Zaturno es una plataforma de gestión de turnos y nómina para empresas colombianas. Permite administrar trabajadores, asignaciones de turnos, marcaciones de ingreso/egreso y liquidaciones de nómina.

3. DATOS PERSONALES Y PRIVACIDAD
Recopilamos los siguientes datos para prestar el servicio:
• Nombre, correo electrónico y número de celular (identificación y comunicación).
• Ubicación geográfica durante el marcaje de ingreso/egreso (validación de geofence).
• Firma electrónica en contratos diarios (almacenada como imagen codificada).
• Datos laborales y salariales proporcionados por la empresa empleadora.

El tratamiento de datos personales se rige por la Ley 1581 de 2012 (habeas data). Consulta nuestra política de privacidad completa en esta app, en Perfil → Política de privacidad.

4. USO ACEPTABLE
No puedes usar Zaturno para actividades ilegales, suplantar identidades o interferir con el servicio. El acceso es personal e intransferible.

5. PROPIEDAD INTELECTUAL
Todo el software, diseño y contenido de Zaturno es propiedad de sus desarrolladores. No se otorgan licencias de uso más allá de lo necesario para operar la aplicación.

6. LIMITACIÓN DE RESPONSABILIDAD
Zaturno no es responsable por pérdidas de datos causadas por fallas en el dispositivo del usuario, conectividad interrumpida o uso indebido de credenciales.

7. MODIFICACIONES
Podemos actualizar estos términos en cualquier momento. Te notificaremos con al menos 7 días de anticipación para cambios materiales.

8. LEY APLICABLE
Estos términos se rigen por la legislación colombiana. Cualquier controversia se someterá a los jueces competentes de Colombia.

9. CONTACTO
soporte@zaturno.app
`;
