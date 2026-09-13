-- Bono extra manual (ej. propina) que el gestor asigna a un turno puntual.
-- Se suma dentro de `pago_total` al guardarse (mismo criterio que
-- registrarEgreso/corregir/cerrarMasivo, que ya recalculan pago_total al
-- cerrar el turno) — bono_monto/bono_motivo quedan como la etiqueta
-- informativa de cuánto de ese total es bono y por qué.
ALTER TABLE asignaciones_turno
  ADD COLUMN bono_monto      DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN bono_motivo     VARCHAR(255) NULL,
  ADD COLUMN bono_creado_por INT NULL,
  ADD COLUMN bono_creado_at  TIMESTAMP NULL;
