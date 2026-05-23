'use strict';

const LiquidacionService = require('./liquidacion.service');
const { generarLiquidacionExcel } = require('../../../utils/liquidacionExcel');

async function obtener(req, res) {
  const data = await LiquidacionService.generar(req.empresa_id, Number(req.params.periodo_id));
  res.json({ success: true, data, message: 'Liquidación del período' });
}

async function exportar(req, res) {
  const periodoId = Number(req.params.periodo_id);
  const liquidacion = await LiquidacionService.generar(req.empresa_id, periodoId);
  const buffer = await generarLiquidacionExcel(liquidacion);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="liquidacion-periodo-${periodoId}.xlsx"`
  );
  res.send(buffer);
}

module.exports = { obtener, exportar };
