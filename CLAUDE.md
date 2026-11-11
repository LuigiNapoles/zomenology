# Cronología interactiva

La especificación completa está en docs/PROYECTO.md. Léela entera antes de empezar cualquier fase.

## Reglas de trabajo
- Trabaja fase a fase según «Plan por fases». No empieces una fase sin cumplir los criterios de la anterior.
- Al terminar cada fase: ejecuta los tests, comprueba sus criterios uno a uno, haz un commit «Fase N: …» y espera mi confirmación.
- No cambies decisiones del documento (stack, modelo de datos, estilos, límites de periodo) sin preguntarme antes.
- Si algo del CSV no encaja con lo descrito, para y enséñame las filas afectadas.
- No inventes datos ni corrijas descripciones de eventos; solo las erratas de nombres de sección indicadas.
- TypeScript estricto, sin `any`. Funciones de escala, fechas y agrupación siempre con tests.
- Sin dependencias nuevas de ejecución salvo Preact y MiniSearch, salvo que lo pida.
- Textos de la interfaz en español.
- Soy principiante con Git y la terminal: explícame en una línea qué hace cada comando que me pidas aprobar.

## Entorno
- Windows. Python se ejecuta con `py` (no `python`).

## Comandos
- py scripts/build_data.py → regenera public/data/*.json
- npm run dev → servidor local
- npm test → tests
- npm run build → build de producción
