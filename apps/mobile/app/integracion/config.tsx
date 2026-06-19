/**
 * Pantalla de configuración de la integración logiq360.
 * Solo visible para admin_empresa.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useIntegracionConfig, useActualizarIntegracion, useEmparejar, generarSecret } from '@/features/integracion/useIntegracion';
import { useTheme } from '@/lib/theme';

const ENDPOINT_PATH = '/api/integracion/eventos';
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-6 pb-2">
      {title}
    </Text>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-card border-b border-border px-4 py-4">
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text className="text-xs text-muted-foreground mb-1">{text}</Text>;
}

interface SecretRowProps {
  label: string;
  hint: string;
  isSet: boolean;
  pending: string | null;
  onGenerate: () => void;
  onClear: () => void;
}

function SecretRow({ label, hint, isSet, pending, onGenerate, onClear }: SecretRowProps) {
  const theme = useTheme();
  return (
    <Row>
      <Label text={label} />
      {pending ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-2 bg-warning/10 border border-warning/30 rounded-xl px-3 py-2">
            <Ionicons name="warning-outline" size={14} color="#F59E0B" />
            <Text className="text-xs text-warning flex-1">Copia esta clave ahora. No se mostrará de nuevo.</Text>
          </View>
          <TextInput
            value={pending}
            editable={false}
            selectTextOnFocus
            className="text-xs font-mono bg-background border border-border rounded-xl px-3 py-2 text-foreground"
            multiline
          />
          <Pressable
            onPress={onClear}
            className="self-start px-3 py-1 rounded-lg border border-border"
          >
            <Text className="text-xs text-muted-foreground">Cancelar</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            {isSet ? (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text className="text-sm text-success">Configurada</Text>
              </>
            ) : (
              <>
                <Ionicons name="ellipse-outline" size={16} color="#94A3B8" />
                <Text className="text-sm text-muted-foreground">Sin configurar</Text>
              </>
            )}
          </View>
          <Pressable
            onPress={onGenerate}
            className="px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: theme.primary + '1A' }}
          >
            <Text className="text-xs font-semibold" style={{ color: theme.primary }}>
              {isSet ? 'Regenerar' : 'Generar'}
            </Text>
          </Pressable>
        </View>
      )}
      <Text className="text-xs text-muted-foreground mt-1">{hint}</Text>
    </Row>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function IntegracionConfigScreen() {
  const router  = useRouter();
  const theme   = useTheme();

  const { data: cfg, isLoading, refetch, isRefetching } = useIntegracionConfig();
  const { mutateAsync: guardar, isPending } = useActualizarIntegracion();
  const { mutateAsync: emparejar, isPending: emparejando } = useEmparejar();

  const [codigoPair, setCodigoPair] = useState('');

  async function handleEmparejar() {
    const codigo = codigoPair.trim();
    if (!codigo) return;
    try {
      const r = await emparejar(codigo);
      setCodigoPair('');
      Alert.alert('Conectado', `Integración vinculada con logiq360 (tenant ${r.logiq360_tenant_id}).`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo emparejar.');
    }
  }

  // Form state — only tracks what the user changes
  const [activo,           setActivo]           = useState(false);
  const [webhookUrl,       setWebhookUrl]       = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [newIncomingSecret,setNewIncomingSecret]= useState<string | null>(null);

  useEffect(() => {
    if (!cfg) return;
    setActivo(Boolean(cfg.activo));
    setWebhookUrl(cfg.webhook_url ?? '');
  }, [cfg]);

  async function handleSave() {
    const payload: Record<string, unknown> = {
      activo,
      webhook_url: webhookUrl.trim() || null,
    };
    if (newWebhookSecret)  payload.webhook_secret  = newWebhookSecret;
    if (newIncomingSecret) payload.incoming_secret = newIncomingSecret;

    try {
      await guardar(payload as Parameters<typeof guardar>[0]);
      setNewWebhookSecret(null);
      setNewIncomingSecret(null);
      Alert.alert('Guardado', 'Configuración actualizada correctamente.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  }

  function confirmRegenerate(type: 'incoming' | 'webhook') {
    const label = type === 'incoming' ? 'clave de verificación' : 'clave de firma';
    Alert.alert(
      'Regenerar clave',
      `¿Generar una nueva ${label}? La clave anterior dejará de funcionar.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Generar',
          onPress: () => {
            const s = generarSecret();
            if (type === 'incoming') setNewIncomingSecret(s);
            else setNewWebhookSecret(s);
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View className="px-4 pt-4 pb-6 gap-1" style={{ backgroundColor: '#6366F1' }}>
          <Text className="text-white text-lg font-bold">Integración logiq360</Text>
          <Text className="text-white/70 text-sm">
            Conecta tu empresa con el sistema de alquiler de equipos
          </Text>
        </View>

        {/* ── Conexión rápida (emparejamiento) ───────────────────── */}
        <SectionHeader title="Conexión rápida" />
        <Row>
          <Label text="Código de emparejamiento de logiq360" />
          <Text className="text-xs text-muted-foreground mb-2">
            En logiq360 → Integración → «Generar código de emparejamiento» y pégalo aquí.
            Las claves se intercambian automáticamente.
          </Text>
          <TextInput
            value={codigoPair}
            onChangeText={setCodigoPair}
            placeholder="Pega el código aquí"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            className="text-xs font-mono bg-background border border-border rounded-xl px-3 py-2.5 text-foreground"
          />
          <Pressable
            onPress={handleEmparejar}
            disabled={emparejando || !codigoPair.trim()}
            className="mt-3 h-11 rounded-2xl items-center justify-center"
            style={{ backgroundColor: emparejando || !codigoPair.trim() ? theme.primary + '80' : theme.primary }}
          >
            {emparejando ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-sm">Conectar con logiq360</Text>
            )}
          </Pressable>
        </Row>

        {/* ── Toggle activo ──────────────────────────────────────── */}
        <Row>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold text-foreground">Activar integración</Text>
              <Text className="text-xs text-muted-foreground">
                {activo ? 'AppTurnos recibe y envía eventos a logiq360' : 'La integración está desactivada'}
              </Text>
            </View>
            <Switch
              value={activo}
              onValueChange={setActivo}
              trackColor={{ true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Row>

        {/* ── AppTurnos recibe de logiq360 ───────────────────────── */}
        <SectionHeader title="AppTurnos recibe de logiq360" />

        <Row>
          <Label text="Endpoint entrante" />
          <TextInput
            value={`${API_BASE}${ENDPOINT_PATH}`}
            editable={false}
            selectTextOnFocus
            className="text-xs font-mono bg-background border border-border rounded-xl px-3 py-2 text-foreground"
          />
          <Text className="text-xs text-muted-foreground mt-1">
            Configura esta URL en logiq360 como destino de webhooks
          </Text>
        </Row>

        <SecretRow
          label="Clave de verificación"
          hint="logiq360 debe firmar sus webhooks con esta clave (X-Turnos-Signature)"
          isSet={cfg?.tiene_incoming_secret ?? false}
          pending={newIncomingSecret}
          onGenerate={() => confirmRegenerate('incoming')}
          onClear={() => setNewIncomingSecret(null)}
        />

        {/* ── AppTurnos envía a logiq360 ─────────────────────────── */}
        <SectionHeader title="AppTurnos envía a logiq360" />

        <Row>
          <Label text="URL webhook logiq360" />
          <TextInput
            value={webhookUrl}
            onChangeText={setWebhookUrl}
            placeholder="https://app.logiq360.com/webhook/appturnos"
            placeholderTextColor="#94A3B8"
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            className="text-sm bg-background border border-border rounded-xl px-3 py-2.5 text-foreground"
          />
        </Row>

        <SecretRow
          label="Clave de firma"
          hint="AppTurnos firma los eventos salientes con esta clave"
          isSet={cfg?.tiene_webhook_secret ?? false}
          pending={newWebhookSecret}
          onGenerate={() => confirmRegenerate('webhook')}
          onClear={() => setNewWebhookSecret(null)}
        />

        {/* ── Enlace a estado ────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/integracion/estado')}
          className="mx-4 mt-4 flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-8 h-8 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#6366F11A' }}
            >
              <Ionicons name="pulse-outline" size={18} color="#6366F1" />
            </View>
            <Text className="text-sm font-semibold text-foreground">Estado de la cola de eventos</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </Pressable>

        {/* ── Guardar ────────────────────────────────────────────── */}
        <View className="px-4 mt-6">
          <Pressable
            onPress={handleSave}
            disabled={isPending}
            className="h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: isPending ? theme.primary + '80' : theme.primary }}
          >
            {isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Guardar configuración</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
