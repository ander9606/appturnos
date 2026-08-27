/**
 * DeduccionesChecklist — preview en vivo de los descuentos de ley (salud/pensión)
 * mientras se digita el salario/tarifa en el formulario de trabajador.
 * Solo se renderiza si la empresa contrata por nómina laboral.
 */
import { CheckCircle2, Circle } from 'lucide-react';
import { useEmpresa } from '@/modules/configuracion/hooks/useConfiguracion';
import { calcularDeducciones, HORAS_MES_NOMINA } from '../laboral';
import { fmtCOP } from '../lib/format';

interface Props {
  tarifaHora: string;
  salarioBase: string;
}

export function DeduccionesChecklist({ tarifaHora, salarioBase }: Props) {
  const { data } = useEmpresa();
  const empresa = data?.data;

  if (empresa?.tipo_contrato !== 'laboral') return null;

  const ibc = tarifaHora ? Number(tarifaHora) * HORAS_MES_NOMINA : Number(salarioBase) || 0;
  if (!ibc) return null;

  const d = calcularDeducciones(ibc);
  const items = [
    { label: 'Salud (4%)', valor: d.salud, aplica: true },
    { label: 'Pensión (4%)', valor: d.pension - d.fondoSolidaridadTasa * ibc, aplica: true },
    {
      label: `Fondo de solidaridad pensional (+${(d.fondoSolidaridadTasa * 100).toFixed(1)}%)`,
      valor: d.fondoSolidaridadTasa * ibc,
      aplica: d.fondoSolidaridadTasa > 0,
      hint: 'Aplica desde 4 SMMLV',
    },
  ];

  return (
    <div className="bg-muted/50 border border-border rounded-xl p-4 flex flex-col gap-2.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Descuentos de ley sobre {fmtCOP(ibc)}/mes
      </p>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          {item.aplica
            ? <CheckCircle2 size={16} className="text-success flex-shrink-0" />
            : <Circle size={16} className="text-muted-foreground/40 flex-shrink-0" />}
          <span className={`text-sm flex-1 ${item.aplica ? 'text-foreground' : 'text-muted-foreground'}`}>
            {item.label}{item.hint && !item.aplica ? ` — ${item.hint}` : ''}
          </span>
          {item.aplica && <span className="text-sm font-semibold text-danger">-{fmtCOP(item.valor)}</span>}
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
        <span className="text-sm font-bold text-foreground">Neto estimado</span>
        <span className="text-sm font-bold text-success">{fmtCOP(d.neto)}/mes</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        No incluye ARL ni caja de compensación: en Colombia esos van 100% a cargo de la empresa, no se descuentan del trabajador.
      </p>
    </div>
  );
}
