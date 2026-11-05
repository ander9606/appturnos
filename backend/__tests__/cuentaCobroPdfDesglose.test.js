'use strict';

// El PDF usa la fuente estándar Helvetica (codificación WinAnsi). Un carácter que no esté ahí sale como basura:
// el signo de resta Unicode "−" salía como una comilla (") en el desglose del descuento.
const { textoDesglose } = require('../utils/cuentaCobroPdf');

// Lo que WinAnsi (cp1252) puede dibujar: ASCII + Latin-1 + unos pocos signos (– — “ ” • … €).
const WIN_ANSI_EXTRA = new Set('–—‘’“”•…€™‚„†‡ˆ‰‹›');
const fueraDeWinAnsi = (texto) => [...texto].filter((c) => c.charCodeAt(0) > 255 && !WIN_ANSI_EXTRA.has(c));

const item = (extra = {}) => ({ valor_base: 70000, pago_extra: 0, bono_monto: 0, descuento_monto: 0, ...extra });

describe('textoDesglose', () => {
  test('sin recargo, bono ni descuento no hay línea de desglose', () => {
    expect(textoDesglose(item())).toBeNull();
  });

  test('el descuento se resta con un guion normal, no con el signo de resta Unicode', () => {
    const texto = textoDesglose(item({ descuento_monto: 5000, descuento_motivo: 'Llegada tarde' }));
    expect(texto).toBe(`Base $ ${(70000).toLocaleString('es-CO')} - descuento $ ${(5000).toLocaleString('es-CO')} (Llegada tarde)`);
    expect(texto).not.toContain('−');
  });

  test('recargo, bono y descuento juntos: todo lo que dibuja el PDF cabe en la fuente', () => {
    const texto = textoDesglose(item({ pago_extra: 8000, bono_monto: 15000, bono_motivo: 'Propina', descuento_monto: 5000, descuento_motivo: 'Tarde' }));
    expect(texto).toMatch(/^Base \$ .* \+ recargo \$ .* \+ bono \$ .* \(Propina\) - descuento \$ .* \(Tarde\)$/);
    expect(fueraDeWinAnsi(texto)).toEqual([]);
  });
});
