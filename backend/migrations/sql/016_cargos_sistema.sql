-- ============================================================
-- 016 — Catálogo ampliado de cargos del sistema
--
-- Agrega roles típicos de trabajo por turnos en Colombia.
-- Usa INSERT IGNORE para ser idempotente (la UNIQUE es (empresa_id, codigo)
-- y NULL = NULL en MySQL crea colisión solo vía INSERT IGNORE).
-- ============================================================

INSERT IGNORE INTO cargos (empresa_id, codigo, nombre, descripcion) VALUES
  (NULL, 'siso',
    'SISO / Coordinador HSE',
    'Responsable de Seguridad Industrial, Salud Ocupacional y Ambiente'),

  (NULL, 'operario_bodega',
    'Operario de bodega',
    'Recepción, almacenamiento y despacho de mercancía'),

  (NULL, 'promotor_ventas',
    'Promotor/a de ventas',
    'Impulsador en punto de venta, degustaciones y activaciones'),

  (NULL, 'cajero',
    'Cajero/a',
    'Manejo de caja registradora, cobro y cuadre de caja'),

  (NULL, 'coordinador_logistico',
    'Coordinador logístico',
    'Coordinación de operaciones de cargue, descargue y distribución'),

  (NULL, 'estibador',
    'Estibador / Montacarguista',
    'Cargue y descargue manual o con montacargas (requiere certificado)'),

  (NULL, 'vigilante',
    'Vigilante / Guarda de seguridad',
    'Control de acceso y vigilancia de instalaciones'),

  (NULL, 'tecnico_instalaciones',
    'Técnico de instalaciones',
    'Instalación y mantenimiento de equipos, stands y estructuras'),

  (NULL, 'mesero',
    'Mesero/a',
    'Atención en mesa para eventos, banquetes y catering'),

  (NULL, 'auxiliar_aseo',
    'Auxiliar de servicios generales',
    'Limpieza y mantenimiento de instalaciones durante eventos'),

  (NULL, 'asesor_comercial',
    'Asesor comercial',
    'Atención al cliente y venta directa en punto de venta'),

  (NULL, 'operario_produccion',
    'Operario de producción',
    'Operación de líneas de producción industrial'),

  (NULL, 'recepcionista',
    'Recepcionista / Anfitrión/a',
    'Atención y registro de visitantes en eventos corporativos'),

  (NULL, 'fotografo',
    'Fotógrafo / Camarógrafo',
    'Registro fotográfico y audiovisual de eventos'),

  (NULL, 'chef_auxiliar',
    'Auxiliar de cocina',
    'Apoyo en preparación de alimentos para eventos y catering');
