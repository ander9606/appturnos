-- Disponibilidad semanal del trabajador: qué días y en qué horario puede trabajar.
-- UNIQUE(empresa_id, trabajador_id, dia_semana) → un slot por día por empresa.
-- dia_semana: 0=dom, 1=lun, 2=mar, 3=mié, 4=jue, 5=vie, 6=sáb.

CREATE TABLE disponibilidad_trabajador (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id      INT NOT NULL,
  trabajador_id   INT NOT NULL,
  dia_semana      TINYINT NOT NULL COMMENT '0=dom ... 6=sab',
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_disp (empresa_id, trabajador_id, dia_semana),
  KEY idx_disp_empresa (empresa_id, trabajador_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;