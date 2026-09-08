import React, { useState } from 'react';
import {
  View, Text, ScrollView, Alert, ActivityIndicator,
  StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import * as WebBrowser from 'expo-web-browser';
import { cuentasCobroApi } from '@api-client';
import { SignaturePad } from '@/features/turnos/SignaturePad';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { formatCOP } from '@/lib/formatters';

// ── helpers ───────────────────────────────────────────────────────────────

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

function fmtLegal(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} de ${MESES[parseInt(m, 10) - 1]} de ${y}`;
}

function fmtH(t: string | null): string { return t?.slice(0, 5) ?? '—'; }

const GESTORES = ['admin_empresa', 'jefe_turnos', 'jefe_nomina'];

// ── screen ────────────────────────────────────────────────────────────────

export default function CuentaCobroScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const qc        = useQueryClient();
  const rol       = useAuthStore((s) => s.usuario?.rol);
  const isGestor  = GESTORES.includes(rol ?? '');
  const [showFirma, setShowFirma] = useState(false);

  const { data: cuenta, isLoading, isError } = useQuery({
    queryKey: ['cuenta-cobro', id],
    queryFn: () => cuentasCobroApi.obtener(Number(id)),
    staleTime: 60_000,
  });

  const firmarM = useMutation({
    mutationFn: (firma_b64: string) => cuentasCobroApi.firmar(Number(id), firma_b64),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cuenta-cobro', id] });
      qc.invalidateQueries({ queryKey: ['mis-cuentas-cobro'] });
      qc.invalidateQueries({ queryKey: ['cuentas-cobro-sin-firmar'] });
      setShowFirma(false);
    },
    onError: () => Alert.alert('Error', 'No se pudo registrar la firma.'),
  });

  async function handleDescargar() {
    const token = await SecureStore.getItemAsync('appturnos.access_token');
    const base  = process.env.EXPO_PUBLIC_API_URL;
    await WebBrowser.openBrowserAsync(`${base}/api/cuentas-cobro/${id}/pdf?token=${token}`);
  }

  // ── states ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FF5A3C" />
      </SafeAreaView>
    );
  }

  if (isError || !cuenta) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#0F172A' }}>Cuenta de cobro no encontrada</Text>
      </SafeAreaView>
    );
  }

  const firmado = Boolean(cuenta.firmado_trabajador);

  let sigXml: string | null = null;
  if (cuenta.firma_b64) {
    try { sigXml = atob(cuenta.firma_b64); } catch { /* malformed — skip */ }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: cuenta.numero_cuenta,
          headerTitleStyle: { fontSize: 15, fontWeight: '700' },
          headerRight: () => (
            <TouchableOpacity
              onPress={handleDescargar}
              hitSlop={10}
              accessibilityLabel="Descargar PDF"
              style={{ marginRight: 4 }}
            >
              <Ionicons name="download-outline" size={22} color="#FF5A3C" />
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: '#E8EEF4' }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {!isGestor && (
            <View style={s.summaryBox}>
              <Ionicons name="information-circle" size={18} color="#2563EB" style={{ marginTop: 1 }} />
              <Text style={s.summaryText}>
                {firmado ? 'Firmaste una' : 'Vas a firmar una'} cuenta de cobro por{' '}
                <Text style={s.summaryEmphasized}>{cuenta.total_turnos} turno{cuenta.total_turnos !== 1 ? 's' : ''}</Text>{' '}
                del período <Text style={s.summaryEmphasized}>{fmtLegal(cuenta.fecha_inicio)}</Text> al{' '}
                <Text style={s.summaryEmphasized}>{fmtLegal(cuenta.fecha_fin)}</Text>, por{' '}
                <Text style={s.summaryEmphasized}>{formatCOP(cuenta.valor_total)}</Text>.
              </Text>
            </View>
          )}

          <View style={s.paper}>

            <Text style={s.docTitle}>CUENTA DE COBRO</Text>
            <Text style={s.docMeta}>N° {cuenta.numero_cuenta}</Text>
            <Text style={s.docMeta}>Período: {fmtLegal(cuenta.fecha_inicio)} al {fmtLegal(cuenta.fecha_fin)}</Text>

            <Divider />

            <SectionHeader label="PARTES" />

            <Text style={s.partyRole}>SEÑORES</Text>
            <Text style={s.partyName}>{cuenta.empresa_nombre}</Text>
            {cuenta.empresa_nit
              ? <Text style={s.partyDetail}>NIT: {cuenta.empresa_nit}</Text>
              : null}

            <View style={{ height: 10 }} />

            <Text style={s.partyRole}>DEBE A</Text>
            <Text style={s.partyName}>{cuenta.trabajador_nombre} {cuenta.trabajador_apellido}</Text>
            <Text style={s.partyDetail}>C.C. {cuenta.trabajador_cedula}</Text>

            <Divider />

            <SectionHeader label="SERVICIOS PRESTADOS" />
            {cuenta.items.map((item) => (
              <View key={item.asignacion_id} style={s.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemDesc}>{item.descripcion}</Text>
                  <Text style={s.itemMeta}>
                    {fmtLegal(item.fecha)} · {fmtH(item.hora_inicio)}–{fmtH(item.hora_fin)} · {Number(item.horas).toFixed(1)}h
                  </Text>
                </View>
                <Text style={s.itemValor}>{formatCOP(item.valor)}</Text>
              </View>
            ))}

            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Total ({cuenta.total_turnos} turno{cuenta.total_turnos !== 1 ? 's' : ''}, {Number(cuenta.total_horas).toFixed(1)}h)</Text>
              <Text style={s.totalsValor}>{formatCOP(cuenta.valor_total)}</Text>
            </View>

            <Divider />

            <SectionHeader label="NATURALEZA JURÍDICA" />
            <Text style={s.clauseBody}>
              El presente documento se expide como cuenta de cobro por servicios prestados de forma
              independiente y autónoma, sin que exista relación laboral, subordinación ni prestaciones
              sociales entre las partes, de conformidad con la legislación colombiana aplicable a
              contratos de prestación de servicios. El prestador del servicio declara estar afiliado y
              al día con sus aportes al Sistema General de Seguridad Social (salud y pensión).
            </Text>

            <Divider />

            <SectionHeader label="FIRMA DEL PRESTADOR DEL SERVICIO" />

            <View style={[s.sigBox, !firmado && s.sigBoxPending]}>
              {sigXml ? (
                <SvgXml xml={sigXml} width="100%" height={90} />
              ) : firmado ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
                  <Text style={{ color: '#16A34A', fontSize: 12 }}>Firmado digitalmente</Text>
                </View>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Ionicons name="create-outline" size={24} color="#D97706" />
                  <Text style={{ color: '#D97706', fontSize: 12 }}>Pendiente de firma</Text>
                </View>
              )}
            </View>

            <View style={s.sigUnderline} />
            <Text style={s.sigName}>{cuenta.trabajador_nombre} {cuenta.trabajador_apellido}</Text>
            <Text style={s.sigDetail}>C.C. {cuenta.trabajador_cedula}</Text>
            {firmado && cuenta.firmado_at ? (
              <Text style={s.sigDetail}>
                Firmado el {new Date(cuenta.firmado_at).toLocaleString('es-CO')}
              </Text>
            ) : null}

            <Text style={s.footer}>Generado por Zaturno · zaturno.app</Text>
          </View>

          {!firmado && !isGestor && (
            cuenta.trabajador_firma_guardada ? (
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={() => firmarM.mutate(cuenta.trabajador_firma_guardada!)}
                  disabled={firmarM.isPending}
                  style={[s.signButton, firmarM.isPending && { opacity: 0.6 }]}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={s.signButtonLabel}>
                    {firmarM.isPending ? 'Firmando…' : 'Firmar con mi firma guardada'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowFirma(true)}
                  disabled={firmarM.isPending}
                  style={{ alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>
                    Firmar con una firma nueva
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setShowFirma(true)}
                style={s.signButton}
              >
                <Ionicons name="pencil" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={s.signButtonLabel}>Firmar cuenta de cobro</Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>
      </SafeAreaView>

      <SignaturePad
        visible={showFirma}
        onClose={() => setShowFirma(false)}
        onConfirm={(b64) => firmarM.mutate(b64)}
        loading={firmarM.isPending}
        confirmLabel="Firmar cuenta de cobro"
        subtitle="Dibuja tu firma para formalizar esta cuenta de cobro"
      />
    </>
  );
}

// ── sub-components ────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 18 }} />;
}

function SectionHeader({ label }: { label: string }) {
  return <Text style={s.sectionHeader}>{label}</Text>;
}

// ── styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  summaryBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#1E3A8A',
  },
  summaryEmphasized: {
    fontWeight: '700',
  },

  paper: {
    backgroundColor: '#FFFEFB',
    borderRadius: 14,
    padding: 26,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },

  docTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#0F172A',
    textTransform: 'uppercase',
    lineHeight: 17,
  },
  docMeta: {
    textAlign: 'center',
    fontSize: 11.5,
    color: '#475569',
    marginTop: 5,
  },

  sectionHeader: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  partyRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  partyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  partyDetail: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  itemValor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
  },
  totalsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalsValor: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },

  clauseBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
    textAlign: 'justify',
  },

  sigBox: {
    height: 110,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginTop: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  sigBoxPending: {
    borderStyle: 'dashed',
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  sigUnderline: {
    height: 1,
    backgroundColor: '#0F172A',
    marginTop: 14,
    marginBottom: 6,
  },
  sigName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  sigDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 24,
    letterSpacing: 0.3,
  },

  signButton: {
    marginTop: 14,
    backgroundColor: '#FF5A3C',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signButtonLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
