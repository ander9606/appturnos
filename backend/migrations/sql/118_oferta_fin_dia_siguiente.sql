-- ============================================================
-- 118 — Turnos que terminan al día siguiente (cruzan la medianoche)
-- `hora_fin_estimada` es solo una hora del día; `fin_dia_siguiente = 1` dice
-- que cae al día siguiente a `fecha`. Las dos columnas generadas (virtuales,
-- sin almacenamiento ni backfill) dan el inicio y el fin como DATETIME, que es
-- lo que usan los topes de horas, los traslapes y el vencimiento del turno:
-- así ninguna consulta repite la lógica de "+1 día".
-- ============================================================

ALTER TABLE ofertas_turno
  ADD COLUMN fin_dia_siguiente TINYINT(1) NOT NULL DEFAULT 0 AFTER hora_fin_estimada,
  ADD COLUMN inicio_ts DATETIME GENERATED ALWAYS AS (TIMESTAMP(fecha, hora_inicio)) VIRTUAL,
  ADD COLUMN fin_ts DATETIME GENERATED ALWAYS AS (
    TIMESTAMP(DATE_ADD(fecha, INTERVAL fin_dia_siguiente DAY), COALESCE(hora_fin_estimada, '23:59:59'))
  ) VIRTUAL;
