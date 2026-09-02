-- ============================================================
-- 078 — Restaura el UNIQUE constraint de periodos_nomina
--
-- La migración 073 original (commit 94706d7) agregaba este mismo constraint
-- para arreglar la causa raíz del bug del 31 de agosto (autoCrear() sin lock
-- creaba períodos duplicados bajo carga concurrente). Se revirtió por completo
-- junto con un merge problemático y nunca se restauró — dejando el catch de
-- ER_DUP_ENTRY en periodos.model.js:crear() como código muerto (sin este
-- índice, MySQL nunca lanza ese error).
--
-- Debe ejecutarse DESPUÉS de 074 (que ya limpia los duplicados vacíos que
-- violarían este constraint) — el orden numérico lo garantiza.
-- ============================================================

ALTER TABLE periodos_nomina
  ADD UNIQUE KEY uk_periodo_fechas (empresa_id, fecha_inicio, fecha_fin);
