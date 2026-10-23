# Golf Coach: inventario visual

Estado al 24 oct 2026. Fuente: rules.js (39 consejos), views.js (biblioteca, Today), app.js (foto del veredicto en vivo), art.js, art-data.js.
Estrategia: fotos generadas con ChatGPT (mismo golfista, misma cancha al amanecer) + guías translúcidas dibujadas por la app.
Los recursos 3D y los dibujos vectoriales se retiraron: un consejo sin foto aprobada se muestra solo con texto, para no mezclar estilos.
Estados: cumple, parcial (falta la foto del error), pendiente (solo texto). Las imágenes se nombran con el ID de la lista de tomas.

| Consejo | Qué debe aprender | Recurso actual | Problema | Representación | Imágenes | Estado |
|---|---|---|---|---|---|---|
| Full swing (secuencia) | Las 17 posiciones | Reproductor con tempo real 3:1 y tira de 17 fotos | Setup con E01 (wedge): A01 tiene otro encuadre | Fotos de frente con reproducción | E01, A02 a A17 | cumple |
| Portada (Today) | Inspirar | Foto A17 (final) con fundido | Provisional | Foto del campo sin golfista | O01 | parcial |
| stance | Ancho de pies según palo | A01 con líneas desde los hombros | Falta el driver | Hierro y driver | A01, D01 | parcial (rehacer D01) |
| chipstance | Pies juntos en el chip | Correcto e incorrecto | | Líneas desde los hombros | H01, H02 | cumple |
| ballpos | Pelota según palo | Wedge y 7 con línea al centro y aro | Falta el driver | Variantes | E01, A01 (D01) | cumple |
| hinge | Inclinarse desde la cadera | Correcto e incorrecto, línea de la espalda | | Desde atrás | B01, B02 | cumple |
| knees | Rodillas flexionadas | Tres variantes, línea cadera rodilla tobillo | | Desde atrás | B01, B03, B04 | cumple |
| reach | Brazos colgando | Correcto y demasiado cerca, plomada | Falta demasiado lejos | Desde atrás | B01, B06 (B05) | parcial (rehacer B05) |
| weightset | Peso a la izquierda | Correcto e incorrecto, barra de peso | | De frente | A01, C01 | cumple |
| tilt | Hombro izquierdo más alto | Correcto e incorrecto, línea de hombros y referencia | | Recorte del torso | A01, C02 | cumple |
| handsahead | Manos adelante | A01 con línea del palo y vertical | Falta el error | Correcto e incorrecto | A01 (C03) | parcial (rehacer C03) |
| forearms | Brazo derecho bajo el izquierdo | Correcto e incorrecto, líneas de antebrazos | | Recorte de brazos | B01, B07 | cumple |
| heels | Peso en la parte delantera | Correcto e incorrecto, barra talón punta | | Desde atrás | B01, B08 | cumple |
| eyesover | Ojos sobre la pelota | I05 con plomada desde los ojos | Falta el error | Correcto e incorrecto | I05 (I06) | parcial (rehacer I06) |
| arms | El cuerpo gira, los brazos siguen | Correcto e incorrecto en el tope | | Sin guías | A06, C04 | cumple |
| tempo | Subida 3, bajada 1 | Reproductor de 6 posiciones con barra 3:1 | | Línea de tiempo | E01, A02, A04, A06, A08, A10 | cumple |
| sway | Girar sin deslizarse | Correcto e incorrecto, línea en el pie derecho | | De frente | A06, C05 | cumple |
| posture | Mantener la altura | Setup e impacto con la línea de la cabeza | Falta el error | Agregar el error | A01, A10 (C06) | parcial |
| feet | Pies firmes | Final con línea sobre el pie izquierdo | Falta el error | Correcto e incorrecto | A16 (C07) | parcial |
| transfer | Peso derecha y luego izquierda | Secuencia de 4 con barra de peso | | | A01, A06, A10, A16 | cumple |
| stayleft | Peso a la izquierda en el impacto | Correcto e incorrecto, barra de peso | | | A10, C08 | cumple |
| upper | Driver: pecho detrás de la pelvis | Texto | | Correcto e incorrecto | D02, D03 | pendiente (rehacer D03) |
| flip | Brazo y palo en línea | A10 con línea hombro mano cabeza del palo | Falta el error | Correcto e incorrecto | A10 (C09) | parcial (rehacer C09) |
| vshape | La V se mantiene | Texto | | Secuencia más error | H01, H03, H04, H07 | pendiente |
| pendulum | Atrás igual que adelante | Texto | | Correcto e incorrecto | H03 a H06 | pendiente |
| headstill | Putt: cabeza quieta | Correcto e incorrecto, línea en la cabeza | | De frente | I03, I04 | cumple |
| grip-left | Mano izquierda | Texto | | Dos primeros planos | J01, J02 | pendiente |
| grip-right | Mano derecha | Primer plano | Falta el segundo paso | Dos primeros planos | J03 (J04) | parcial |
| grip-style | Vardon | Texto | | Primer plano | J04 | pendiente |
| grip-check | Cara cuadrada con el brazo estirado | Texto | | Correcto e incorrecto | K01, K02 | pendiente |
| grip-palm | Dedos, no palma | Texto | | Correcto e incorrecto | L01, L02 | pendiente |
| aim | Pies y hombros paralelos | Texto | | Correcto e incorrecto | G01, G02 | pendiente |
| setup-steps | Postura en pasos | Texto | | Secuencia de 4 | F01, F02, F03, B01 | pendiente (rehacer F02, F03) |
| driver-up | Pegar subiendo | Texto | | Foto con trayectoria | D02 | pendiente |
| speed | Velocidad después de la pelota | A11 | | Una foto | A11 | cumple |
| strike | Centro de la cara | Texto | | Tres primeros planos | M01 a M03 | pendiente |
| chip-steps | Chip en tres pasos | Texto | | Secuencia de 3 | H01, H03, H04 | pendiente |
| putt-setup | Postura de putt | De frente y desde atrás | | Variantes | I01, I05 | cumple |
| putt-grip | Agarre de putt | Texto | | Primer plano | J05 | pendiente |
| putt-stroke | Golpe con los hombros | Secuencia de 3 con el triángulo | | | I01, I02, I03 | cumple |
| bunker | Salida de bunker | Texto | | Postura y golpe | N01, N02 | pendiente |

Resumen: 18 cumple, 9 parciales (incluida la portada), 14 pendientes de imagen. 25 consejos ya muestran fotos, más la secuencia y la portada.

## Control de detalle (24 oct)

Revisión pelota contra cabeza del palo, posición de la pelota según palo, guante, manos y pies en las 50 fotos aprobadas.
- C03: la pelota quedó del lado equivocado de la cabeza del palo. Rehacer.
- D01 y D03: con driver la pelota está casi al centro; debe ir justo dentro del talón izquierdo. Rehacer.
- C09: la pelota se movió hasta el pie izquierdo; debe estar en el mismo lugar que en A10. Rehacer.
- I06: el guante quedó en la mano derecha. Rehacer.
- Fotos desde atrás: ChatGPT puso la pelota al lado de la punta del palo. Desde atrás de las manos la pelota está delante de la cara y casi tapada por la cabeza del palo. Se corrigió por retoque en B01 a B04, B06 a B08 y F01 (tools/photos/ballfix.py). En B05, F02 y F03 la pelota tapaba la punta del palo y no se puede corregir bien: rehacer.
- A01 salió más grande que el resto de la serie de frente: en los consejos se escala al mismo tamaño; en la secuencia completa el setup es E01.

No requieren foto: diagrama de dónde poner la cámara (dibujo), cuadros del informe de sesión (salen del video del usuario).
