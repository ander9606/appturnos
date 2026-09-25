-- ============================================================
-- 086 — Horas acumuladas de la semana antes de este día
--
-- calcularHoras() ya calcula cuántas horas ordinarias+nocturnas llevaba el
-- trabajador esta semana (lunes hasta ayer) para decidir si el día de hoy
-- entra en el cupo ordinario (42h) o pasa a extra — pero ese número solo
-- vivía en memoria durante el cálculo, nunca se guardaba. Sin él, la UI no
-- puede explicar POR QUÉ un día salió con horas extra ("llevabas 40h esta
-- semana, por eso 2h de hoy caben en tu cupo y el resto es extra").
-- ============================================================

ALTER TABLE registros_diarios
  ADD COLUMN horas_acumuladas_semana DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER jornada_continua;
