# Golf Coach: inventario visual

Estado al 24 oct 2026. Fuente: rules.js (39 consejos), views.js (biblioteca, Today), app.js (foto del veredicto en vivo), art.js, art-data.js.
Estrategia: fotos generadas con ChatGPT (mismo golfista, misma cancha al amanecer) + guías translúcidas dibujadas por la app.
Fuente de las imágenes: el set final de 71 fotos (una por ID). Las fotos desde atrás del primer lote conservan el retoque de la pelota.
Estados: cumple, parcial (falta la foto del error), pendiente (solo texto).

| Consejo | Qué debe aprender | Representación | Imágenes | Estado |
|---|---|---|---|---|
| Full swing (secuencia) | Las 17 posiciones | Reproductor a tempo 3:1 y tira de fotos | A01 a A17 | cumple |
| Portada (Today) | Inspirar | Foto de la cancha con fundido | O01 | cumple |
| stance | Ancho de pies según palo | Hierro y driver, líneas desde los hombros | A01, D01 | cumple |
| chipstance | Pies juntos en el chip | Correcto e incorrecto | H01, H02 | cumple |
| ballpos | Pelota según palo | Wedge, 7 y driver con línea al centro y aro | E01, A01, D01 | cumple |
| hinge | Inclinarse desde la cadera | Línea de la espalda | B01, B02 | cumple |
| knees | Rodillas flexionadas | Línea cadera rodilla tobillo | B01, B03, B04 | cumple |
| reach | Brazos colgando | Plomada desde el hombro | B01, B05, B06 | cumple |
| weightset | Peso a la izquierda | Barra de peso | A01, C01 | cumple |
| tilt | Hombro izquierdo más alto | Línea de hombros y referencia | A01 (primera versión), C02 | cumple |
| handsahead | Manos adelante | Línea del palo y vertical | A01, C03 | cumple |
| forearms | Brazo derecho bajo el izquierdo | Líneas de antebrazos | B01, B07 | cumple |
| heels | Peso en la parte delantera | Barra talón punta | B01, B08 | cumple |
| eyesover | Ojos sobre la pelota | Plomada desde los ojos | I05, I06 | cumple |
| arms | El cuerpo gira, los brazos siguen | Sin guías | A06, C04 | cumple |
| tempo | Subida 3, bajada 1 | Reproductor de 6 posiciones con barra 3:1 | A01, A02, A04, A06, A08, A10 | cumple |
| sway | Girar sin deslizarse | Línea en el pie derecho | A06, C05 | cumple |
| posture | Mantener la altura | Línea a la altura de la cabeza | A10, C06 | cumple |
| feet | Pies firmes | Línea sobre el pie izquierdo, aro en el pie | A16, C07 | cumple |
| transfer | Peso derecha y luego izquierda | Secuencia de 4 con barra de peso | A01, A06, A10, A16 | cumple |
| stayleft | Peso a la izquierda en el impacto | Barra de peso | A10, C08 | cumple |
| upper | Driver: pecho detrás de la pelvis | Puntos de pecho y pelvis | D02 (D03) | parcial (rehacer D03) |
| flip | Brazo y palo en línea | Línea hombro mano cabeza del palo | A10, C09 | cumple |
| vshape | La V se mantiene | Secuencia de 3 más el error | H01, H03, H04, H07 | cumple |
| pendulum | Atrás igual que adelante | Dos correctas, dos incorrectas | H03 a H06 | cumple |
| headstill | Putt: cabeza quieta | Línea en la cabeza | I03, I04 | cumple |
| grip-left | Mano izquierda | Dos pasos | J01, J02 | cumple |
| grip-right | Mano derecha | Dos pasos | J03, J04 | cumple |
| grip-style | Vardon | Primer plano del meñique | (J04) | pendiente |
| grip-check | Cara cuadrada con los brazos estirados | Correcto e incorrecto | (K01, K02) | pendiente |
| grip-palm | Dedos, no palma | Correcto e incorrecto | L01, L02 | cumple |
| aim | Pies y hombros paralelos | Correcto e incorrecto | G01 (G02) | parcial (rehacer G02) |
| setup-steps | Postura en pasos | Secuencia de 4 | F01, F02, F03, B01 | cumple |
| driver-up | Pegar subiendo | Flecha de la trayectoria | D02 | cumple |
| speed | Velocidad después de la pelota | Una foto | A11 | cumple |
| strike | Centro de la cara | Centro, punta y talón | M01, M02, M03 | cumple |
| chip-steps | Chip en tres pasos | Secuencia con barra de peso | H01, H03, H04 | cumple |
| putt-setup | Postura de putt | De frente y desde atrás | I01, I05 | cumple |
| putt-grip | Agarre de putt | Primer plano | J05 | cumple (detalle: grip de hierro) |
| putt-stroke | Golpe con los hombros | Secuencia con el triángulo | I01, I02, I03 | cumple |
| bunker | Salida de bunker | Postura y golpe | N01, N02 | cumple |

Resumen: 37 cumple, 2 parciales, 2 pendientes.

## Control de detalle del set final

Revisión de las 29 fotos nuevas: pelota contra cabeza del palo, posición de la pelota según palo, guante, manos, pies, encuadre.
- D03: la pelota del driver quedó unas dos pelotas y media más atrás que en D01 y D02. Rehacer.
- G02: la varilla que debía ir por la punta de los pies quedó al lado de la pelota; no se puede comparar el pie con la línea. Rehacer.
- K01 y K02: en K01 la punta del palo está inclinada unos 19 grados y en K02 unos 38; ninguna muestra claramente cuadrada contra abierta. Rehacer.
- J04: completa bien el agarre, pero no se ve el meñique derecho sobre los dedos izquierdos (Vardon). Se usa en el agarre de la mano derecha; grip-style sigue en texto.
- Detalles menores aceptados: en F02 la pelota queda hacia la punta del palo; en J05 el grip es redondo de hierro, no de putter. La posición de las manos, que es lo que enseña el consejo, es correcta.
- A01 nueva tiene el mismo encuadre que la serie y reemplaza a la anterior en la secuencia. La primera A01 sigue solo en la inclinación de hombros, donde muestra mejor la diferencia.
- H03 y H07 salieron con otro encuadre que H01 a H06; se escalan al mismo tamaño en los consejos de chip.
- Retoque anterior: en B01 a B04, B06 a B08 y F01 la pelota se movió delante de la cara del palo (tools/photos/ballfix.py).

No requieren foto: diagrama de dónde poner la cámara (dibujo), cuadros del informe de sesión (salen del video del usuario).
