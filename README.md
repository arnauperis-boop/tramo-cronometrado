# Tramo Cronometrado

Simulador de rallies en 3D que funciona en el navegador. Cada tramo se genera a partir de su número (TC 1, TC 2…), con curvas de grado 1 a 6, horquillas, crestas y saltos. El copiloto canta las notas antes de cada curva y el cronómetro marca dos parciales y la meta.

Todo el juego está en `index.html`. Usa [three.js](https://threejs.org) 0.160 desde jsDelivr y dos fuentes de Google Fonts; no hace falta compilar nada.

## Jugar

Sirve la carpeta con cualquier servidor estático y abre la página:

```sh
python3 -m http.server 8080
# http://localhost:8080
```

Para publicarlo en GitHub Pages: **Settings → Pages → Deploy from a branch**, rama `main`, carpeta `/ (root)`.

## Controles

| Acción | Teclado | Mando |
| --- | --- | --- |
| Acelerar | ↑ / W | RT |
| Frenar (marcha atrás si estás parado) | ↓ / S | LT |
| Dirección | ← → / A D | Stick izquierdo |
| Freno de mano | Espacio | A o B |
| Bajar / subir marcha (cambio manual) | Q / E | LB / RB |
| Volver a la carretera (+5 s) | R | X |
| Cambiar cámara | C | Y |
| Pausa | Esc / P | Start |
| Silenciar | M | |

En móvil y tablet aparecen botones táctiles. Se juega mejor en horizontal.

## Qué simula

- **Coche:** modelo de bicicleta con neumáticos tipo Pacejka, transferencia de peso, tracción total 42/58, caja de 6 marchas automática o manual, freno de mano que bloquea el eje trasero, saltos y daños que restan potencia. La física corre a 240 Hz.
- **Superficies:** grava, asfalto y nieve, cada una con su agarre, resistencia a la rodadura y comportamiento del neumático. Fuera de la carretera hay menos agarre y los árboles y rocas son obstáculos.
- **Ayudas** (se pueden quitar en el menú): control de tracción y ABS que reservan el agarre que se está usando para girar, control de estabilidad y contravolante automático. Sin ayudas hay que dosificar gas y freno; es mejor con mando.
- **Copiloto:** notas con dirección, grado, modificadores (*larga*, *se cierra*, *no cortes*, *cuidado*) y distancia hasta la siguiente. Se leen en voz alta si el navegador tiene voz en español.

Los ajustes y los mejores tiempos se guardan en el `localStorage` del navegador.

## Pruebas

`test/autopilot.mjs` conduce tramos completos con un piloto automático usando la física del juego y falla si el coche no llega a meta o la simulación da valores no numéricos.

```sh
npm install
npx playwright install chromium
npm test
STAGES=1,4,7 SURFACES=nieve npm test   # tramos y superficies concretos
KEYBOARD=1 npm test                     # dirección todo o nada, como con teclado
```

## Ideas pendientes

- Coche fantasma con la mejor pasada
- Tramos de noche con los faros
- Lluvia y barro
- Campeonato de varios tramos
- Reglajes del coche (reparto de frenada, dureza, desarrollos)
