-- Si la empresa suma los recargos nocturno y dominical/festivo al liquidar.
-- 1 = regla de ley (default, no cambia nada). 0 = solo se acumulan las horas
-- trabajadas (todas ordinarias, sin recargos ni extras) y se avisa al pasar 42 h/semana.
ALTER TABLE empresas
  ADD COLUMN sumar_nocturnas_festivo TINYINT(1) NOT NULL DEFAULT 1;
