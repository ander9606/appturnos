import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InfoRow } from '@/components/ui/InfoRow';
import type { Trabajador, TipoDocumento, SexoTrabajador, TipoCuenta } from '@api-client';
import { DateField, PillRow, FieldInput } from './campos';
import { fmtFecha } from './fechasPerfil';
import type { FormState, SetCampo } from './perfilForm';

/** Cada sección se ve en lectura (`InfoRow`) o en edición (campos del formulario) según `editing`. */
interface SeccionProps {
  editing: boolean;
  perfil: Trabajador;
  form: FormState;
  set: SetCampo;
}


export function IdentificacionSection({ editing, perfil, form, set }: SeccionProps) {
  return (
    <>
    <SectionHeader title="Identificación" />
    <View className="mx-5 rounded-2xl border border-border overflow-hidden">
      {editing ? (
        <>
          <PillRow
            label="Tipo de documento"
            options={['CC', 'CE', 'PAS'] as TipoDocumento[]}
            value={form.tipo_documento}
            onChange={set('tipo_documento')}
            labels={{ CC: 'Cédula (CC)', CE: 'Cédula Ext. (CE)', PAS: 'Pasaporte' }}
          />
          <FieldInput
            label="Número de documento"
            value={form.cedula}
            onChangeText={set('cedula')}
            keyboardType="numeric"
            last
          />
        </>
      ) : (
        <>
          <InfoRow
            label="Tipo doc."
            value={{ CC: 'Cédula (CC)', CE: 'Cédula Ext. (CE)', PAS: 'Pasaporte' }[perfil.tipo_documento ?? 'CC']}
          />
          <InfoRow label="Documento" value={perfil.cedula} last />
        </>
      )}
    </View>
    </>
  );
}

export function PersonalSection({ editing, perfil, form, set }: SeccionProps) {
  return (
    <>
    <SectionHeader title="Información personal" />
    <View className="mx-5 rounded-2xl border border-border overflow-hidden">
      {editing ? (
        <>
          <DateField
            label="Fecha de nacimiento"
            value={form.fecha_nacimiento}
            onChange={set('fecha_nacimiento')}
            maximumDate={new Date()}
          />
          <PillRow
            label="Sexo"
            options={['M', 'F', 'otro'] as SexoTrabajador[]}
            value={form.sexo as SexoTrabajador}
            onChange={set('sexo')}
            labels={{ M: 'Masculino', F: 'Femenino', otro: 'Otro' }}
          />
          <FieldInput
            label="Teléfono"
            value={form.telefono}
            onChangeText={set('telefono')}
            keyboardType="phone-pad"
          />
          <FieldInput
            label="Dirección"
            value={form.direccion}
            onChangeText={set('direccion')}
            placeholder="Se imprime en tu contrato de prestación de servicios"
            last
          />
        </>
      ) : (
        <>
          <InfoRow label="Nacimiento" value={fmtFecha(perfil.fecha_nacimiento)} />
          <InfoRow
            label="Sexo"
            value={
              perfil.sexo
                ? ({ M: 'Masculino', F: 'Femenino', otro: 'Otro' } as Record<string, string>)[perfil.sexo]
                : null
            }
          />
          <InfoRow label="Teléfono" value={perfil.telefono} />
          <InfoRow label="Dirección" value={perfil.direccion} last />
        </>
      )}
    </View>
    </>
  );
}

export function SobreMiSection({ editing, perfil, form, set }: SeccionProps) {
  return (
    <>
    <SectionHeader title="Sobre mí" />
    <View className="mx-5 rounded-2xl border border-border overflow-hidden">
      {editing ? (
        <FieldInput
          label="Descripción"
          value={form.descripcion}
          onChangeText={set('descripcion')}
          placeholder="Cuéntale a las empresas qué sabes hacer, tu experiencia y tus fortalezas…"
          multiline
          maxLength={500}
          last
        />
      ) : (
        <View className="px-5 py-3.5 bg-card">
          <Text className="text-xs text-muted-foreground mb-1">Descripción</Text>
          <Text className="text-sm text-foreground leading-5">
            {perfil.descripcion || 'Aún no has escrito una descripción de tu perfil.'}
          </Text>
        </View>
      )}
    </View>
    </>
  );
}

export function SeguridadSocialSection({ editing, perfil, form, set }: SeccionProps) {
  return (
    <>
    <SectionHeader title="Seguridad social" />
    <View className="mx-5 rounded-2xl border border-border overflow-hidden">
      {editing ? (
        <>
          <FieldInput label="EPS" value={form.eps} onChangeText={set('eps')} />
          <FieldInput label="AFP / Fondo de pensión" value={form.afp} onChangeText={set('afp')} last />
        </>
      ) : (
        <>
          <InfoRow label="EPS" value={perfil.eps} />
          <InfoRow label="AFP" value={perfil.afp} last />
        </>
      )}
    </View>
    </>
  );
}

export function BancariosSection({ editing, perfil, form, set }: SeccionProps) {
  return (
    <>
    <SectionHeader title="Datos bancarios" />
    <View className="mx-5 rounded-2xl border border-border overflow-hidden">
      {editing ? (
        <>
          <FieldInput label="Banco" value={form.banco} onChangeText={set('banco')} />
          <PillRow
            label="Tipo de cuenta"
            options={['ahorros', 'corriente'] as TipoCuenta[]}
            value={form.tipo_cuenta as TipoCuenta}
            onChange={set('tipo_cuenta')}
            labels={{ ahorros: 'Ahorros', corriente: 'Corriente' }}
          />
          <FieldInput
            label="Número de cuenta"
            value={form.numero_cuenta}
            onChangeText={set('numero_cuenta')}
            keyboardType="numeric"
            last
          />
        </>
      ) : (
        <>
          <InfoRow label="Banco" value={perfil.banco} />
          <InfoRow
            label="Tipo"
            value={perfil.tipo_cuenta
              ? perfil.tipo_cuenta.charAt(0).toUpperCase() + perfil.tipo_cuenta.slice(1)
              : null}
          />
          <InfoRow label="Cuenta" value={perfil.numero_cuenta} last />
        </>
      )}
    </View>
    </>
  );
}

export function EmergenciaSection({ editing, perfil, form, set }: SeccionProps) {
  return (
    <>
    <SectionHeader title="Contacto de emergencia" />
    <View className="mx-5 rounded-2xl border border-border overflow-hidden">
      {editing ? (
        <>
          <FieldInput
            label="Nombre"
            value={form.contacto_emergencia_nombre}
            onChangeText={set('contacto_emergencia_nombre')}
          />
          <FieldInput
            label="Teléfono"
            value={form.contacto_emergencia_tel}
            onChangeText={set('contacto_emergencia_tel')}
            keyboardType="phone-pad"
            last
          />
        </>
      ) : (
        <>
          <InfoRow label="Nombre" value={perfil.contacto_emergencia_nombre} />
          <InfoRow label="Teléfono" value={perfil.contacto_emergencia_tel} last />
        </>
      )}
    </View>
    </>
  );
}

export function AntecedentesSection({ editing, perfil, form, set }: SeccionProps) {
  return (
    <>
    <SectionHeader title="Certificados de antecedentes" />
    <View className="mx-5 rounded-2xl border border-border overflow-hidden">
      {editing ? (
        <>
          <DateField
            label="Antecedentes judiciales"
            value={form.ant_judiciales_fecha}
            onChange={set('ant_judiciales_fecha')}
            maximumDate={new Date()}
          />
          <DateField
            label="Antecedentes disciplinarios"
            value={form.ant_disciplinarios_fecha}
            onChange={set('ant_disciplinarios_fecha')}
            maximumDate={new Date()}
            last
          />
        </>
      ) : (
        <>
          <InfoRow label="Judiciales" value={fmtFecha(perfil.ant_judiciales_fecha)} />
          <InfoRow label="Disciplinarios" value={fmtFecha(perfil.ant_disciplinarios_fecha)} last />
        </>
      )}
    </View>
    </>
  );
}
