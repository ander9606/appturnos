-- ============================================================
-- 021 — Calificaciones 0-estrella para no_presentado
-- Permite calificacion = 0 (automático cuando el trabajador no
-- se presentó) y calificado_por = NULL (sistema automático).
-- ============================================================

ALTER TABLE calificaciones_turno
  MODIFY calificacion TINYINT NOT NULL
    COMMENT '0 a 5 (0 = no se presentó — calificación automática del sistema)',
  MODIFY calificado_por INT NULL
    COMMENT 'usuario_id del jefe que califica; NULL = automático por no_presentado';
