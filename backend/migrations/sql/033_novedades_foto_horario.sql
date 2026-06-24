ALTER TABLE novedades
  ADD COLUMN hora_evento  DATETIME     NULL AFTER descripcion,
  ADD COLUMN foto_b64     MEDIUMTEXT   NULL AFTER hora_evento;
