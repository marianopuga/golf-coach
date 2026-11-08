# Coach de casa

Una página para practicar el swing en el living, sin pelota, con la idea de Ben Hogan (Five Lessons). La cámara del celular o del Mac mira tu cuerpo, la página detecta cada swing y te habla en español con una voz grabada natural. Todo corre en tu equipo: el video nunca sale de él.

Link: https://marianopuga.github.io/golf-coach/casa/

## Cómo se usa

1. Abre el link en Safari (iPhone) o Chrome (Mac). Elige el ángulo, tu mano y tu altura. Toca Empezar y acepta la cámara.
2. La cámara a 2 metros, a la altura del ombligo. Basta que te vea de la cabeza a las rodillas, con espacio arriba para las manos. Mejor el celular vertical: si tiene lente ultra gran angular (0,5x), la página lo elige sola.
3. Ponte en address y quédate quieto un segundo (suena un tono). Haz el swing lento. Después de cada swing te dice una cosa buena y una sola corrección.

## Qué mide

De frente: cabeza de lado y arriba o abajo, cadera en la subida (deslizamiento), cadera que inicia la bajada (secuencia), peso al impacto y al final, giro de hombros y torsión (aproximados), final sostenido y tempo.

Desde atrás: cabeza hacia o desde la pelota, cadera hacia la pelota (extensión temprana), inclinación de la columna.

Con dos dispositivos a la vez (uno de frente y otro desde atrás) se juntan las dos vistas en un solo swing.

## Cómo aprende de ti

1. Ruido: mide cuánto "se mueve" tu cuerpo estando quieto en el address. Bajo 2,5 veces eso no corrige.
2. Sin falsas alarmas: con una medición débil (cámara lenta, te saliste del cuadro, swing muy rápido) la medición queda "no medible". Una corrección solo se dice si se repite o si es muy clara.
3. Plan escalonado: cabeza quieta, cadera sin deslizar, cadera primero, torsión, todo junto. Avanza cuando haces bien la etapa en 5 de tus últimos 6 swings.
4. Metas personales: parten un poco mejor que tu mediana y se aprietan cuando las logras.
5. Tendencias: tus últimos 5 swings contra los 5 anteriores. Avisa si estás mejorando, empeorando, más o menos consistente, o si al arreglar algo se desarmó otra cosa.
6. Sensación contra realidad: marca tus swings como "se sintió bien" o "mal". Con 3 de cada uno te dice qué medición separa tus buenos swings de los malos.
7. "Eso está mal medido": a la segunda vez en la misma medición, la ajusta a ti (nunca más que el ancho del rango).

## Voz y comandos

La voz es Alex (Kokoro, voz neuronal libre, acento latino), grabada una vez con `tools/record_voice_es.py`. Si una frase no está grabada, la dice la mejor voz en español del equipo. El micrófono es opcional y solo reacciona a frases que parten con "profe".

## Límites

1. Una cámara ve en 2D: de frente no ve la distancia a la pelota, desde atrás no ve el deslizamiento lateral.
2. El giro de hombros y la torsión se estiman en 3D con una sola cámara: sirven para comparar tus swings entre sí, no como grados exactos.
3. No ve el palo ni las muñecas.
4. Los centímetros se calculan desde tu altura: son aproximados, pero comparables entre tus swings.

## Archivos

1. `core.js`: detección del swing, mediciones, calidad, perfil personal, tendencias, comandos. Sin DOM.
2. `lines.js`: todo lo que dice el coach (lo mismo que se graba).
3. `app.js`, `index.html`: cámara, modelo de pose (MediaPipe), conversación, replay, progreso.
4. `speech.js`, `listen.js`, `link.js`: voz, escucha y conexión entre dos dispositivos (PeerJS).
5. `voice/alex/`: las frases grabadas.

Pruebas: `node test/casa.test.mjs` (swings simulados en `test/casa-sim.mjs`).
