# Personaje de Instagram (el perro de Zaturno)

Guía de modelo del personaje que presenta Zaturno en los reels. Es un dibujo hecho con código (SVG): no hay imágenes fuente, todo sale de `perro.js`.

| Archivo | Para qué |
|---|---|
| `perro.js` | `perro(pose)` dibuja al perro a partir de una lista de datos (brazos, piernas, cara, objetos). Animar = cambiar esos datos en el tiempo. |
| `guia.html` | Arma las 4 hojas de la guía (giro, caras, situaciones, actuación). |
| `render2.js` | Convierte las hojas en PNG: `node render2.js guia.html hoja1 hoja2 hoja3 hoja4` (usa Playwright). |
| `hoja1.png` … `hoja4.png` | Guía lista para consultar al animar. |

## Reglas del personaje
- Sin ropa y sin gorra. El logo (planeta con anillo) vive en la medalla naranja del collar, a la derecha.
- El collar siempre es verde (`#059669`). Estilo plano, sin contornos.
- La actuación está en tres controles: cejas canela, ojos y boca.
- Paleta en `perro.js` (objeto `C`); las hojas muestran los códigos.
