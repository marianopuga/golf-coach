# Golf Coach: inventario visual

Estado al 23 oct 2026. Fuente: rules.js (39 consejos), views.js (biblioteca, Today), app.js (foto del veredicto en vivo), art.js, art-data.js, illus.js.
Estrategia nueva: fotos generadas con ChatGPT (mismo golfista, misma cancha al amanecer) + guías translúcidas dibujadas por la app sobre cada foto.
Estados: cumple, corregir, sustituir, pendiente. Las imágenes se nombran con el ID de la lista de tomas (A01 a O01).

| Consejo | Qué debe aprender | Recurso actual | Problema | Representación recomendada | Imágenes | Estado |
|---|---|---|---|---|---|---|
| Full swing (secuencia) | Las 17 posiciones del swing de hierro | 17 renders 3D sobre oscuro + reproducción | Calidad lejos de la referencia | Secuencia de fotos de frente con reproducción | A01 a A17 | sustituir |
| Portada (Today) | Inspirar | 3 renders 3D | Pedido: campo de golf | Foto del campo, sin golfista | O01 | pendiente |
| stance | Pies al ancho de hombros con hierros, más anchos con driver | Par 3D oscuro | Calidad | Dos variantes correctas, líneas desde los hombros | A01, D01 | sustituir |
| chipstance | Pies juntos y postura algo abierta en el chip | Par 3D oscuro | Calidad | Correcto e incorrecto | H01, H02 | sustituir |
| ballpos | La pelota avanza según el palo | Par 3D oscuro | Calidad | Tres variantes (wedge, 7, driver), línea al centro | E01, A01, D01 | sustituir |
| hinge | Inclinarse desde la cadera con la espalda recta | Par 3D oscuro | Calidad | Correcto e incorrecto desde atrás, línea de la espalda | B01, B02 | sustituir |
| knees | Rodillas flexionadas, ni rectas ni sentado | Par 3D oscuro | Calidad | Tres variantes desde atrás | B01, B03, B04 | sustituir |
| reach | Brazos colgando bajo los hombros | Par 3D oscuro | Calidad | Tres variantes desde atrás, plomada desde el hombro | B01, B05, B06 | sustituir |
| weightset | Pecho hacia el objetivo, más peso a la izquierda | Par 3D oscuro | Calidad | Correcto e incorrecto, barra de peso | A01, C01 | sustituir |
| tilt | Hombro izquierdo más alto | Par 3D oscuro | Calidad | Correcto e incorrecto, línea de hombros | A01, C02 | sustituir |
| handsahead | Manos un poco adelante de la pelota | Par 3D oscuro | Calidad | Correcto e incorrecto, línea del palo | A01, C03 | sustituir |
| forearms | Brazo derecho no por encima del izquierdo | Par 3D oscuro | Calidad | Correcto e incorrecto desde atrás | B01, B07 | sustituir |
| heels | Peso en la parte delantera de los pies | Par 3D oscuro | Calidad | Correcto e incorrecto desde atrás, plomada | B01, B08 | sustituir |
| eyesover | Putt: ojos sobre la pelota | Dibujo vectorial | Estilo distinto | Correcto e incorrecto desde atrás | I05, I06 | sustituir |
| arms | El cuerpo gira, los brazos siguen | Par 3D oscuro | Calidad | Correcto e incorrecto en el tope | A06, C04 | sustituir |
| tempo | Subida más lenta que la bajada | Dibujo vectorial | Estilo distinto | Línea de tiempo con fotos de la secuencia | A01, A02, A04, A06, A08, A10 | sustituir |
| sway | Girar la cadera sin deslizarse | Par 3D oscuro | Calidad | Correcto e incorrecto en el tope, línea en el pie derecho | A06, C05 | sustituir |
| posture | Mantener la altura hasta el impacto | Par 3D oscuro | Calidad | Correcto e incorrecto en el impacto | A10, C06 | sustituir |
| feet | Pies firmes | Par 3D oscuro | Calidad | Correcto e incorrecto en el final | A16, C07 | sustituir |
| transfer | Peso a la derecha al subir, a la izquierda al terminar | Fotos (prototipo) | A06 sin giro de hombros | Secuencia de 4 fotos, línea del pie izquierdo y barra de peso | A01, A06, A10, A16 | corregir (rehacer A06) |
| stayleft | Peso a la izquierda en el impacto | Par 3D oscuro | Calidad | Correcto e incorrecto, barra de peso | A10, C08 | sustituir |
| upper | Driver: pecho detrás de la pelvis | Par 3D oscuro | Calidad | Correcto e incorrecto con los dos puntos de la regla | D02, D03 | sustituir |
| flip | Brazo y palo en línea en el impacto | Par 3D oscuro | Calidad | Correcto e incorrecto, línea brazo y palo | A10, C09 | sustituir |
| vshape | La V de hombros y manos se mantiene | Par 3D oscuro | Calidad | Secuencia de 3 más el error | H01, H03, H04, H07 | sustituir |
| pendulum | Atrás tan largo como adelante | Dibujo vectorial | Estilo distinto | Correcto e incorrecto con medidas | H03 a H06 | sustituir |
| headstill | Putt: cabeza quieta | Dibujo vectorial | Estilo distinto | Correcto e incorrecto | I03, I04 | sustituir |
| grip-left | Mano izquierda en el grip | Ninguno | Sin imagen | Dos primeros planos en orden | J01, J02 | pendiente |
| grip-right | Mano derecha en el grip | Ninguno | Sin imagen | Dos primeros planos en orden | J03, J04 | pendiente |
| grip-style | Agarre Vardon | Ninguno | Sin imagen | Primer plano con el meñique marcado | J04 | pendiente |
| grip-check | La cara queda cuadrada con los brazos estirados | Ninguno | Sin imagen | Correcto e incorrecto | K01, K02 | pendiente |
| grip-palm | Grip en los dedos, no en la palma | Ninguno | Sin imagen | Correcto e incorrecto | L01, L02 | pendiente |
| aim | Pies y hombros paralelos a la línea | Render 3D | Calidad | Correcto e incorrecto con varillas y bandera | G01, G02 | sustituir |
| setup-steps | Armar la postura en cinco pasos | Render 3D | Calidad | Secuencia de 4 fotos desde atrás | F01, F02, F03, B01 | sustituir |
| driver-up | Driver: pegar subiendo | Render 3D | Calidad | Una foto con la trayectoria dibujada | D02 | sustituir |
| speed | Máxima velocidad después de la pelota | Ninguno | Sin imagen | Una foto con brazos extendidos | A11 | pendiente |
| strike | Pegar en el centro de la cara | Ninguno | Sin imagen | Tres primeros planos de la cara | M01 a M03 | pendiente |
| chip-steps | Chip en tres pasos | Render 3D | Calidad | Secuencia de 3 fotos | H01, H03, H04 | sustituir |
| putt-setup | Postura de putt | Dibujo vectorial | Estilo distinto | De frente y desde atrás | I01, I05 | sustituir |
| putt-grip | Agarre de putt | Ninguno | Sin imagen | Primer plano | J05 | pendiente |
| putt-stroke | Golpe de putt con los hombros | Dibujo vectorial | Estilo distinto | Secuencia de 3 fotos | I01, I02, I03 | sustituir |
| bunker | Salida de bunker | Render 3D | Calidad | Postura abierta y golpe en la arena | N01, N02 | sustituir |

Resumen: 1 en prototipo (corregir), 30 por sustituir, 8 pendientes sin imagen, más la secuencia y la portada.
No requieren foto: diagrama de dónde poner la cámara (dibujo), cuadros del informe de sesión (salen del video del usuario).
