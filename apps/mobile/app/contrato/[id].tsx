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
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { contratosApi } from '@api-client';
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

function fmtH(t: string): string { return t?.slice(0, 5) ?? ''; }

const GESTORES = ['admin_empresa', 'jefe_turnos'];

// ── screen ────────────────────────────────────────────────────────────────

export default function ContratoScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const qc        = useQueryClient();
  const rol       = useAuthStore((s) => s.usuario?.rol);
  const isGestor  = GESTORES.includes(rol ?? '');
  const [showFirma, setShowFirma] = useState(false);

  const { data: contrato, isLoading, isError } = useQuery({
    queryKey: ['contrato', id],
    queryFn: () => contratosApi.obtener(Number(id)),
    staleTime: 60_000,
  });

  const firmarM = useMutation({
    mutationFn: (firma_b64: string) => contratosApi.firmar(Number(id), firma_b64),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contrato', id] });
      qc.invalidateQueries({ queryKey: ['mis-contratos'] });
      setShowFirma(false);
    },
    onError: () => Alert.alert('Error', 'No se pudo registrar la firma.'),
  });

  async function handleDescargar() {
    const token = await SecureStore.getItemAsync('appturnos.access_token');
    const base  = process.env.EXPO_PUBLIC_API_URL;
    await WebBrowser.openBrowserAsync(`${base}/api/contratos/${id}/pdf?token=${token}`);
  }

  // ── states ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#FF5A3C" />
      </SafeAreaView>
    );
  }

  if (isError || !contrato) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600', color: '#0F172A' }}>Contrato no encontrado</Text>
      </SafeAreaView>
    );
  }

  const firmado = Boolean(contrato.firmado_trabajador);

  // Decode SVG base64 firma
  let sigXml: string | null = null;
  if (contrato.firma_b64) {
    try { sigXml = atob(contrato.firma_b64); } catch { /* malformed — skip */ }
  }

  // Numerar cláusulas dinámicamente según si hay lugar o no
  const hayLugar = Boolean(contrato.lugar);
  const nums = hayLugar
    ? { objeto: 'PRIMERA', duracion: 'SEGUNDA', lugar: 'TERCERA', valor: 'CUARTA', natura: 'QUINTA' }
    : { objeto: 'PRIMERA', duracion: 'SEGUNDA', valor: 'TERCERA', natura: 'CUARTA' } as any;

  return (
    <>
      <Stack.Screen
        options={{
          title: contrato.numero_contrato,
          headerTitleStyle: { fontSize: 15, fontWeight: '700' },
          headerRight: isGestor ? () => (
            <TouchableOpacity onPress={handleDescargar} hitSlop={10} style={{ marginRight: 4 }}>
              <Ionicons name="download-outline" size={22} color="#FF5A3C" />
            </TouchableOpacity>
          ) : undefined,
        }}
      />

      <SafeAreaView style={{ flex: 1, backgroundColor: '#E8EEF4' }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Papel ───────────────────────────────────────────── */}
          <View style={s.paper}>

            {/* ENCABEZADO */}
            <Text style={s.docTitle}>CONTRATO DE PRESTACIÓN{'\n'}DE SERVICIOS POR TURNO</Text>
            <Text style={s.docMeta}>N° {contrato.numero_contrato}</Text>
            <Text style={s.docMeta}>Ciudad de Bogotá, {fmtLegal(contrato.fecha)}</Text>

            <Divider />

            {/* PARTES */}
            <SectionHeader label="PARTES" />

            <Text style={s.partyRole}>CONTRATANTE</Text>
            <Text style={s.partyName}>{contrato.empresa_nombre}</Text>
            {contrato.empresa_nit
              ? <Text style={s.partyDetail}>NIT: {contrato.empresa_nit}</Text>
              : null}

            <View style={{ height: 10 }} />

            <Text style={s.partyRole}>CONTRATISTA</Text>
            <Text style={s.partyName}>{contrato.trabajador_nombre} {contrato.trabajador_apellido}</Text>
            <Text style={s.partyDetail}>C.C. {contrato.trabajador_cedula}</Text>

            <Divider />

            {/* CLÁUSULAS */}
            <SectionHeader label="CLÁUSULAS" />

            <Clausula num={nums.objeto} titulo="OBJETO">
              El CONTRATISTA se compromete a prestar sus servicios como:{'\n'}
              <Text style={s.clauseEmphasized}>{contrato.descripcion_labor || contrato.oferta_titulo}</Text>
            </Clausula>

            <Clausula num={nums.duracion} titulo="DURACIÓN">
              El presente contrato rige el día{' '}
              <Text style={s.clauseEmphasized}>{fmtLegal(contrato.fecha)}</Text>, entre las{' '}
              <Text style={s.clauseEmphasized}>{fmtH(contrato.hora_inicio)}</Text> y las{' '}
              <Text style={s.clauseEmphasized}>{fmtH(contrato.hora_fin_estimada)}</Text> horas.
            </Clausula>

            {hayLugar && (
              <Clausula num={nums.lugar!} titulo="LUGAR DE EJECUCIÓN">
                {contrato.lugar}
              </Clausula>
            )}

            <Clausula num={nums.valor} titulo="VALOR Y FORMA DE PAGO">
              El CONTRATANTE pagará al CONTRATISTA la suma de{' '}
              <Text style={s.clauseEmphasized}>{formatCOP(contrato.valor_dia)} (COP)</Text>{' '}
              por la jornada pactada, una vez el CONTRATISTA haya completado la labor y firmado el presente contrato.
            </Clausula>

            <Clausula num={nums.natura} titulo="NATURALEZA JURÍDICA">
              El presente contrato es de carácter civil y no genera relación laboral,
              prestaciones sociales ni vínculo de subordinación. El CONTRATISTA actúa
              con plena autonomía técnica en el desarrollo del objeto contratado.
              Cualquier controversia se someterá a los jueces competentes de la República de Colombia.
            </Clausula>

            <Divider />

            {/* FIRMA */}
            <SectionHeader label="FIRMA DEL CONTRATISTA" />

            {/* Caja de firma */}
            <View style={[s.sigBox, !firmado && s.sigBoxPending]}>
              {sigXml ? (
                <SvgXml xml={sigXml} width="100%" height={90} />
              ) : firmado ? (
                // Firmado pero sin imagen (fallback)
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

            {/* Línea de firma + datos */}
            <View style={s.sigUnderline} />
            <Text style={s.sigName}>{contrato.trabajador_nombre} {contrato.trabajador_apellido}</Text>
            <Text style={s.sigDetail}>C.C. {contrato.trabajador_cedula}</Text>
            {firmado && contrato.firmado_at ? (
              <Text style={s.sigDetail}>
                Firmado el {new Date(contrato.firmado_at).toLocaleString('es-CO')}
              </Text>
            ) : null}

            {/* Pie de página del documento */}
            <Text style={s.footer}>Generado por Zaturno · zaturno.app</Text>
          </View>

          {/* Botón firmar — solo trabajador, solo si no firmado */}
          {!firmado && !isGestor && (
            <TouchableOpacity
              onPress={() => setShowFirma(true)}
              style={s.signButton}
            >
              <Ionicons name="pencil" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.signButtonLabel}>Firmar contrato</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>

      <SignaturePad
        visible={showFirma}
        onClose={() => setShowFirma(false)}
        onConfirm={(b64) => firmarM.mutate(b64)}
        loading={firmarM.isPending}
        confirmLabel="Firmar contrato"
        subtitle="Dibuja tu firma para formalizar este contrato"
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

function Clausula({ num, titulo, children }: { num: string; titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.clauseHeader}>{num} – {titulo}</Text>
      <Text style={s.clauseBody}>{children}</Text>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
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

  // Encabezado del documento
  docTitle: {
    textAlign: 'center',
    fontSize: 12,
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

  // Sección header
  sectionHeader: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Partes
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

  // Cláusulas
  clauseHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  clauseBody: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  clauseEmphasized: {
    fontWeight: '700',
    color: '#0F172A',
  },

  // Firma
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

  // Footer del documento
  footer: {
    textAlign: 'center',
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 24,
    letterSpacing: 0.3,
  },

  // Botón firmar
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
