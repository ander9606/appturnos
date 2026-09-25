-- ============================================================
-- 071 — Alcance de puntos_marcaje (biblioteca de ubicaciones)
--
-- Hasta ahora puntos_marcaje solo se usaba para marcación de
-- trabajadores/cargos (fijo/zonal). Ahora también se ofrece como
-- biblioteca reutilizable al crear turnos (ofertas_turno.lugar/
-- latitud/longitud se pueden prellenar desde un punto guardado).
--
-- `alcance` deja elegir, al crear el punto, si debe aparecer
-- también en ese selector de turnos ('todos') o si es exclusivo
-- de marcación de nómina ('nomina').
-- ============================================================

ALTER TABLE puntos_marcaje
  ADD COLUMN alcance ENUM('todos', 'nomina') NOT NULL DEFAULT 'todos'
    COMMENT 'todos = también disponible al elegir ubicación de un turno; nomina = solo para marcación fija/zonal de trabajadores'
    AFTER tipo;
