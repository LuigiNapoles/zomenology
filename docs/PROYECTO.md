# Cronología Interactiva — Documento de proyecto

Nov 11, 2026 · @Luigi

## Resumen y objetivos

Una web estática con una línea temporal interactiva de 10.872 eventos, desde el Big Bang (hace 13.800 millones de años) hasta 2026, accesible con un enlace público. Los datos salen de `cronologia.csv`, extraído de los apuntes en PDF (339 páginas) de un estudiante de Historia. El aspecto visual cambia según el periodo histórico que se está viendo.

**Objetivos**

1. **Explorar**: recorrer toda la cronología con zoom continuo, de la escala geológica (Ma) al día y mes.
2. **Consultar**: pinchar cualquier evento y leer su ficha completa.
3. **Encontrar**: buscar por texto y filtrar por sección, tipo de fecha y rango.
4. **Aprender jugando**: contemporáneos, evento aleatorio y quiz cronológico.
5. **Compartir**: un enlace a la web y un enlace directo a cada evento.

**Fuera de alcance (v1)**: edición de eventos desde la web, cuentas de usuario, imágenes por evento, varios idiomas.

**Usuario principal**: estudiante de Historia que repasa y relaciona eventos; secundario, cualquier persona curiosa que reciba el enlace.

## Datos de partida

`cronologia.csv` tiene 10.872 filas y 20 columnas, en UTF-8 con BOM y separador coma. El rango va de −13.800.000.000 (Big Bang) a 2026, y los años negativos son a.C. sin año 0.

| Columna | Contenido | Uso en la web |
| --- | --- | --- |
| `id` | Entero único (1–10.872) | Clave del evento y enlace directo |
| `seccion` | 57 secciones del PDF, p. ej. «Medieval (XIII)» | Macrocategoría, carril y filtro |
| `pagina` | Página del PDF (1–339) | Se muestra en la ficha |
| `descripcion` | Texto del evento (mediana 37 caracteres, máx. 624) | Título y cuerpo de la ficha |
| `fecha_texto` | Fecha tal como aparece en el PDF, p. ej. «05-10\|1851», «fl.c. 1550-1620» | Fecha legible en la ficha |
| `tipo_fecha` | evento (10.346), vida (192), muerte (104), floruit (104), nacimiento (7) | Icono y filtro |
| `inicio`, `fin` | Año numérico astronómico de comienzo y final | Posición en el eje |
| `mes_inicio`, `dia_inicio`, `mes_fin`, `dia_fin` | Mes y día cuando existen (≈3 %) | Precisión al zoom máximo |
| `aproximada` | «sí» en 1.837 filas | Marcador visual de fecha aproximada |
| `escala` | año, ka, Ma (y mixtas Ma/ka, ka/año) | Formato de etiquetas |
| `era` | d.C., a.C., ka BP, Ma y combinaciones | Formato de la fecha mostrada |
| `origen_era` | Cómo se dedujo la era: sección, explícita, contexto… | Solo depuración |
| `otras_fechas` | Fechas secundarias, p. ej. «n. 1764 ; 1795» | Línea extra en la ficha |
| `duplicado_de` | id del original si es duplicado (728 filas) | Excluir |
| `revisar` | Motivo de revisión (143 filas) | Excluir o listar aparte |
| `texto_original` | Línea original del PDF | Solo depuración |

**Distribución temporal (por `inicio`)**: 1.182 eventos antes de −10.000; 4.883 entre −10.000 y el año 0; 2.827 entre 1 y 1499; 1.839 desde 1500. El 62 % de los eventos son anteriores a nuestra era, así que la escala lineal no sirve por sí sola.

**Puntos y periodos**: 2.202 eventos tienen `inicio` = `fin` (puntos) y 8.501 tienen `inicio` < `fin` (barras).

**Convenciones detectadas**

- Los a.C. son negativos directos: 25 a.C. = −25, sin año 0.
- Las fechas en ka BP se convierten con referencia a 1950: «6 ka BP» = −4.050.
- Las fechas en Ma se convierten sin referencia: «4.600 Ma» = −4.600.000.000.

**Limpieza obligatoria antes de usar**

- Excluir las 728 filas con `duplicado_de` relleno.
- Mover a una lista aparte («Sin fecha») las 119 filas con `revisar` = «sin fecha al final», visibles desde el buscador pero fuera del eje.
- Corregir o excluir la fila con «inicio posterior al fin».
- Mantener las 23 filas con era o escala supuesta, formato complejo o alternativas, marcadas como aproximadas.
- Rellenar `fin` vacío con `inicio` (5 filas), salvo los rangos abiertos («6 ka BP-»), que se pintan como punto con indicador de continuidad.
- Corregir erratas frecuentes de las secciones en la etiqueta mostrada: «Contempt» → Contemporánea, «Moerna» → Moderna.

## Modelo de datos y pipeline

Un script de Python convierte el CSV en dos JSON compactos que la web carga al arrancar; la web nunca lee el CSV directamente.

**Script**: `scripts/build_data.py` (pandas). Entrada: `data/cronologia.csv`. Salidas:

- `public/data/events.json`: eventos con fecha, ordenados por `inicio`.
- `public/data/undated.json`: eventos sin fecha, solo para el buscador.
- `data/build_report.md`: recuento de filas leídas, excluidas por motivo, exportadas y por macrocategoría.

**Pasos del script**

1. Leer con `encoding="utf-8-sig"` para quitar el BOM de la columna `id`.
2. Aplicar la limpieza de la sección anterior.
3. Asignar a cada sección su macrocategoría con la tabla de abajo; si aparece una sección no mapeada, el script falla con su nombre.
4. Calcular `ya` (años antes de hoy) = 2027 − `inicio`, mínimo 1, para la escala logarítmica.
5. Exportar con claves cortas, sin espacios y sin campos vacíos.
6. Validar: ningún `id` repetido, `inicio` ≤ `fin` en todas las filas, toda fila con macrocategoría.

**Formato de cada evento en `events.json`**

```json
{"id":42,"s":3,"d":"Maximiliano I de México","f":"n.1832-m.06|1867","t":"v","a":1832,"b":1867,"mb":6,"ap":0,"e":"d.C.","o":"","p":2}
```

| Clave | Origen | Notas |
| --- | --- | --- |
| `id` | `id` | Se conserva para enlaces estables |
| `s` | `seccion` | Índice en el array `sections`; la sección lleva su macrocategoría |
| `d` | `descripcion` | Texto tal cual |
| `f` | `fecha_texto` | Fecha legible |
| `t` | `tipo_fecha` | e = evento, v = vida, m = muerte, f = floruit, n = nacimiento |
| `a`, `b` | `inicio`, `fin` | Números; `b` se omite si es igual a `a` |
| `ma`, `da`, `mb`, `db` | Mes y día de inicio y fin | Solo si existen |
| `ap` | `aproximada` | 1 si es aproximada u otra marca de revisión menor |
| `e` | `era` | Para formatear la fecha |
| `o` | `otras_fechas` | Solo si existe |
| `p` | `pagina` | Página del PDF |
| `x` | Derivado | 1 si el rango es abierto (sin final) |

Cabecera del JSON: `{"version":1,"generated":"<fecha>","macros":[…],"sections":[{"name":"Medieval (XIII)","label":"Medieval (s. XIII)","macro":6}],"events":[…]}`.

**Macrocategorías (carriles)**

| # | Macrocategoría | Secciones del CSV |
| --- | --- | --- |
| 0 | Tiempo profundo | Prehistoria (-2'58 Ma) |
| 1 | Paleolítico | Paleolítico Inicial-Medio, Paleolítico Final |
| 2 | Neolítico | Neolítico inicial (11'6 - 7'5 ka BP), Neolítico inicial (-5500), Neolítico medio, Neolítico final |
| 3 | Próximo Oriente antiguo | Las 9 secciones «Antigua próx oriente» |
| 4 | Antigüedad | Las 7 secciones «Antigua (…)» |
| 5 | Mundo clásico | Las 7 secciones «Clásica (…)» |
| 6 | Edad Media | Las 10 secciones «Medieval (…)» |
| 7 | Edad Moderna | Moerna (1492-1550), (1551-1648), (1649-1789) |
| 8 | Edad Contemporánea | Contempt (1790-1850), Contempt (1851-) |
| 9 | Mundo extraeuropeo | América (1d.c-), Asia (1 d.C-), África (1 d.C-), Historia extraeuropea (-1 a.C) |
| 10 | Geografía | Geografía (-1900), (1901-1950), (1951-2026) |
| 11 | Temas | Historia Arte, Historia Literatura, Ciencia pura y medicina, Ciencia aplicada, Historia filosofía y pensamiento, Biblia, Historia España |

Dentro de «Temas», cada sección sigue siendo filtrable por separado.

**Tamaño esperado**: unos 1,2 MB sin comprimir y 300 KB con gzip, servido comprimido por el hosting.

## Funcionalidades

La v1 incluye 14 funcionalidades en cuatro bloques; las marcadas como (v2) quedan fuera de la primera entrega.

### Navegación

**F1. Eje temporal con zoom continuo**

- Zoom con rueda, pellizco y botones +/−; desplazamiento arrastrando o con flechas del teclado.
- Zoom anclado al cursor o al centro del pellizco.
- Límites: desde todo el rango (13.800 Ma) hasta unos 2 meses en pantalla.
- Las etiquetas del eje se adaptan a la escala visible: Ma → ka → milenios → siglos → décadas → años → meses.
- Formato de etiquetas: «4.600 Ma», «45 ka», «3000 a.C.», «s. XIII», «1851», «jul 1851».
- Animación suave (ease-out, 250 ms) en botones y saltos.

**F2. Modos de escala**

- **Lineal**: proporcional a los años reales.
- **Logarítmica (por defecto)**: posición según log10 de los años antes de hoy. El Big Bang, la Prehistoria y el siglo XX comparten pantalla de forma legible.
- Interruptor visible «Lineal / Logarítmica»; al cambiar, se conserva el evento o fecha del centro.
- En modo logarítmico, el eje marca hitos de referencia (1 Ma, 100 ka, 10 ka, 1000 a.C., año 1, 1500, 1900).

**F3. Minimapa de eras**

- Barra fina inferior con todo el rango y las eras coloreadas con su color de periodo.
- Un rectángulo marca la ventana visible; se puede arrastrar y pinchar para saltar.
- Debajo, botones de salto rápido: Big Bang, Tierra, Paleolítico, Neolítico, Antigüedad, Clásica, Edad Media, Moderna, Contemporánea, Hoy.

**F4. Carriles por macrocategoría**

- Un carril horizontal por cada una de las 12 macrocategorías, con su nombre fijo a la izquierda.
- Los carriles vacíos en la ventana visible se pliegan para ganar espacio.
- Dentro de cada carril, los eventos se apilan en filas para no solaparse.
- Opción «Agrupar por sección» (v2): un sub-carril por cada una de las 57 secciones.

### Representación

**F5. Puntos y barras**

- Evento puntual: círculo de 8 px. Periodo: barra con extremos redondeados, ancho mínimo 8 px.
- Rango abierto («6 ka BP-»): barra con degradado que se desvanece hacia la derecha.
- Fecha aproximada: borde discontinuo o halo difuso.
- Icono pequeño por `tipo_fecha`: vida (silueta), muerte (cruz), floruit (estrella), nacimiento (asterisco).
- Etiqueta de texto a la derecha del marcador cuando cabe; si no, solo el marcador.

**F6. Agrupación y nivel de detalle**

- Cuando varios eventos caen en el mismo hueco de unos 24 px, se muestran como una burbuja con el número («+42»).
- Pinchar la burbuja hace zoom hasta que se separan o, si no es posible, abre una lista con los eventos agrupados.
- Prioridad para mostrar etiqueta: periodos más largos primero, luego eventos con descripción más larga.

### Contenido

**F7. Ficha del evento**

- Al pinchar o pulsar Intro sobre un evento: panel lateral en escritorio y hoja inferior en móvil.
- Contenido: descripción completa, fecha original (`fecha_texto`), duración calculada si es periodo, tipo de fecha, aviso de fecha aproximada, otras fechas, sección y página del PDF.
- Acciones: copiar enlace al evento, «¿Qué pasaba a la vez?» (F11), centrar en el eje, cerrar.
- Flechas «anterior / siguiente» para recorrer los eventos por orden cronológico.

**F8. Buscador**

- Campo de búsqueda siempre visible, atajo de teclado «/».
- Búsqueda tolerante: sin distinguir mayúsculas ni tildes, con prefijos y errores leves.
- Hasta 20 resultados con descripción, fecha y sección; incluye los eventos sin fecha, marcados como tales.
- Elegir un resultado centra el eje en el evento y abre su ficha.

**F9. Filtros**

- Macrocategorías y secciones (casillas por grupo, con «todas / ninguna»).
- Tipo de fecha (evento, vida, muerte, floruit, nacimiento).
- Solo fechas exactas (oculta las aproximadas).
- Rango temporal (desde / hasta), con entrada en años, a.C. o Ma.
- Contador de eventos visibles tras filtrar y botón «Restablecer».

**F10. Enlaces y estado en la URL**

- Cada evento tiene enlace directo con hash: `#e42`.
- Al abrir un enlace, el eje se centra en el evento y se abre su ficha.
- La vista actual (centro, zoom, escala y filtros) se guarda en `localStorage` y se restaura al volver.

### Aprender jugando

**F11. «¿Qué pasaba a la vez?»**

- Desde la ficha: lista de eventos de otras macrocategorías que se solapan con el evento abierto.
- Si el evento es puntual, se usa una ventana de ±10 años (±10 % de la antigüedad en fechas anteriores a −10.000).
- Ordenados por cercanía, agrupados por macrocategoría, máximo 5 por grupo.

**F12. «Sorpréndeme»**

- Botón que salta a un evento aleatorio y abre su ficha con una animación de viaje por el eje.
- Respeta los filtros activos.

**F13. Quiz cronológico**

- Modo **Ordena**: 4 eventos aleatorios para arrastrar en orden cronológico; se corrige mostrando las fechas.
- Modo **¿Qué siglo?**: un evento y 4 opciones de siglo o milenio.
- Rondas de 10 preguntas, marcador y racha; mejor puntuación guardada en `localStorage`.
- Filtro de dificultad por periodo, con la opción de usar los filtros activos.
- Solo usa eventos con fecha exacta, sin «aproximada».

**F14. Escala humana**

- En la ficha, una línea comparativa: «Si toda la historia del universo cupiera en un año, esto ocurrió el 31 de diciembre a las 23:59:58».
- Para eventos históricos, la comparación cambia a «hace X generaciones» (25 años por generación).

**(v2)**: imágenes por evento, modo presentación, exportar una selección a PDF, sub-carriles por sección, modo oscuro en los estilos por periodo.

## Diseño visual por periodos

La web cambia de piel según la fecha que hay en el centro de la pantalla: 10 estilos, del cosmos estrellado al museo moderno. La estructura, los controles y el texto de lectura no cambian, para que el cambio sea ambiental y no estorbe.

**Reglas comunes**

- Lo que cambia por periodo: fondo, superficies, color de tinta, acento, tipografía de títulos, textura y adornos.
- Lo que no cambia: disposición, iconos, tamaños, tipografía de lectura (**Source Sans 3**) y colores de macrocategoría.
- Cada estilo es un conjunto de variables CSS en `:root[data-period="…"]`.
- Al cruzar un límite, las variables se interpolan en 600 ms; con `prefers-reduced-motion` el cambio es instantáneo.
- Las texturas se generan con SVG (`feTurbulence`) o degradados CSS, sin imágenes externas.
- Todo texto cumple contraste WCAG AA (4,5:1) sobre su fondo; el acento solo se usa en texto si también lo cumple.

**Los 10 estilos**

| Periodo | Rango | Concepto | Fondo / superficie | Tinta / acento | Títulos | Textura y adornos |
| --- | --- | --- | --- | --- | --- | --- |
| Cosmos | Big Bang → −4.540 Ma | Cielo estrellado | #0B0E1A / #151A2E | #E6E9F5 / #8AB4FF | Space Grotesk | Campo de estrellas con paralaje suave; marcadores con halo luminoso |
| Tierra profunda | −4.540 Ma → −2,58 Ma | Estratos geológicos | #2B211B / #3A2D24 | #F1E6D8 / #D9822B | Fraunces | Bandas horizontales de roca en el fondo de los carriles; grano mineral |
| Paleolítico | −2,58 Ma → −9700 | Pintura rupestre | #E9DCC6 / #F3EADB | #2A1E16 / #A8432A | Caveat Brush | Textura de caliza; separadores con trazo de carbón |
| Neolítico | −9700 → −3300 | Barro y cerámica | #EADBC4 / #F5ECDD | #3B2A1E / #8C5A2B | Josefin Slab | Cenefas de cerámica incisa en cabeceras |
| Antigüedad | −3300 → −800 | Papiro y lapislázuli | #EFE3C2 / #F7EED6 | #2B2416 / #1F6F8B | Marcellus | Fibras de papiro; frisos geométricos; detalles en oro #C8A04A |
| Mundo clásico | −800 → 476 | Mármol y fresco | #F4F1EA / #FFFFFF | #1E1E1E / #9E2B25 | Cinzel | Vetas de mármol suaves; greca en cabeceras |
| Edad Media | 476 → 1492 | Manuscrito iluminado | #F1E7D0 / #F8F1E1 | #2A1A12 / #8B1E1E | Cormorant Garamond | Pergamino; capitular en la ficha (UnifrakturCook); azul ultramar #1F3A7A y oro #B8902F |
| Edad Moderna | 1492 → 1789 | Grabado y cartografía | #F3EEE3 / #FBF8F1 | #1D1B18 / #2E5B4E | IM Fell English | Trama de grabado; rosa de los vientos en el minimapa |
| Siglo XIX | 1789 → 1914 | Prensa y litografía | #F2EFE8 / #FFFFFF | #111111 / #B22222 | Playfair Display | Filetes dobles de periódico; papel ligeramente envejecido |
| Siglos XX–XXI | 1914 → hoy | Museo moderno | #FAFAF7 / #FFFFFF | #111418 / #E4572E | Archivo | Retícula suiza, mucho aire, sin textura |

**Colores de macrocategoría**

- 12 colores fijos, distinguibles entre sí y para daltonismo (base Okabe-Ito ampliada).
- Se usan en el relleno de los marcadores, la etiqueta del carril y los filtros.
- En Cosmos y Tierra profunda se aclaran un 20 % para mantener el contraste sobre fondo oscuro.

**Selector de estilo**

- «Por periodo» (por defecto), «Neutro claro» y «Neutro oscuro».
- Los neutros usan la paleta Siglos XX–XXI y su versión oscura, para quien prefiera lectura sin adornos.

**Tipografías**

- Todas de Google Fonts, autoalojadas con subconjunto latino y `font-display: swap`.
- Carga diferida: solo la del periodo actual y las dos vecinas; el resto al quedar el navegador inactivo.

## Arquitectura técnica

Web estática sin servidor: Vite + TypeScript, el eje pintado en Canvas 2D y los paneles en Preact. Solo dos dependencias de ejecución.

| Pieza | Elección | Motivo |
| --- | --- | --- |
| Build | Vite + TypeScript (modo estricto) | Arranque rápido y salida estática |
| Interfaz (paneles, filtros, quiz) | Preact | Componentes con 3 KB de peso |
| Eje temporal | Canvas 2D propio | Pintar 10.000 elementos con fluidez; ninguna librería de timelines maneja Ma y escala logarítmica |
| Búsqueda | MiniSearch | Índice en el navegador, búsqueda difusa y por prefijo |
| Datos | Python + pandas | Pipeline reproducible del CSV al JSON |
| Tests | Vitest | Escala, formato de fechas, agrupación |
| Estilos | CSS con variables, sin framework | Los temas por periodo son conjuntos de variables |

Versiones: la última estable de cada paquete al instalar, fijada en `package.json` y `requirements.txt`.

**Estructura de carpetas**

```
cronologia/
├─ data/              cronologia.csv, build_report.md
├─ scripts/           build_data.py
├─ public/
│  ├─ data/           events.json, undated.json
│  └─ fonts/          tipografías autoalojadas
├─ src/
│  ├─ main.tsx
│  ├─ data/           load.ts, types.ts
│  ├─ timeline/       scale.ts, ticks.ts, layout.ts, cluster.ts,
│  │                  renderer.ts, interaction.ts, minimap.ts
│  ├─ themes/         periods.ts, themes.css, textures.ts
│  ├─ features/       contemporaries.ts, random.ts, quiz.ts, humanScale.ts
│  ├─ state/          store.ts (estado, hash de la URL, localStorage)
│  ├─ format/         dates.ts
│  └─ ui/             Header, SearchBox, Filters, EventPanel, Quiz, StylePicker
└─ tests/
```

**Módulos clave**

- `scale.ts`: convierte año ↔ píxel en modo lineal y logarítmico. Vista = {centro, amplitud}; en logarítmico trabaja sobre log10(2027 − año).
- `ticks.ts`: elige el paso de las marcas del eje (Ma, ka, milenio, siglo, década, año, mes) para que haya entre 6 y 12 visibles.
- `layout.ts`: apila los eventos visibles de cada carril en filas (asignación voraz por inicio, reservando el ancho de la etiqueta).
- `cluster.ts`: agrupa marcadores que caen a menos de 24 px y decide qué etiquetas caben.
- `renderer.ts`: pinta con `requestAnimationFrame` solo cuando cambia el estado, respetando `devicePixelRatio`.
- `interaction.ts`: rueda, arrastre, pellizco, teclado y detección del elemento bajo el puntero por búsqueda binaria en x.
- `periods.ts`: límites de los 10 estilos y cálculo del periodo activo según el centro de la vista.
- `format/dates.ts`: muestra cualquier número como «4.600 Ma», «45 ka», «3000 a.C.», «s. XIII» o «jul 1851» según la escala.
- `store.ts`: estado único (vista, filtros, evento abierto, estilo); sincroniza `#e<id>` y `localStorage`.

**Decisión de rendimiento**: con 10.000 eventos, recorrer todos en cada frame para saber cuáles se ven cuesta menos de 1 ms. No se usa índice espacial salvo que una medición supere los 4 ms por frame.

## Rendimiento, accesibilidad y móvil

La web debe ir a 60 fps al hacer zoom en un portátil medio y cargar en menos de 3 s con 4G.

**Objetivos de rendimiento**

| Métrica | Objetivo |
| --- | --- |
| Peso inicial (HTML + JS + CSS, gzip) | < 120 KB |
| Datos (`events.json`, gzip) | ≈ 300 KB |
| Primera pintura del eje | < 2,5 s en 4G |
| Tiempo de pintado por frame | < 8 ms en escritorio, < 16 ms en móvil medio |
| Búsqueda (escribir → resultados) | < 50 ms |
| Lighthouse Performance | ≥ 90 en móvil |

- El índice de búsqueda se construye después de la primera pintura, con `requestIdleCallback`.
- El layout de carriles se recalcula al terminar el zoom (debounce de 100 ms); durante el gesto se escala el último layout.
- Las texturas se pintan una vez en un canvas fuera de pantalla y se reutilizan.

**Accesibilidad**

- El canvas lleva al lado una lista accesible y oculta de los eventos visibles (máximo 200), con botones enfocables que abren la ficha.
- Teclado: Tab recorre los eventos visibles; Intro abre la ficha; Esc la cierra; flechas desplazan; + y − hacen zoom; «/» va al buscador.
- La ficha es un diálogo con foco atrapado y título anunciado.
- Contraste AA en todos los estilos; tamaño mínimo de texto 14 px; objetivos táctiles de 44 px.
- `prefers-reduced-motion`: sin estrellas animadas, sin paralaje ni transiciones de estilo.
- La información no depende solo del color: los tipos de fecha llevan icono y las fechas aproximadas, borde discontinuo.

**Móvil**

- Por debajo de 768 px: carriles más bajos, etiquetas de carril abreviadas y ficha como hoja inferior deslizable.
- Gestos: pellizco para zoom, arrastre horizontal para desplazar, toque para abrir.
- Filtros y quiz en pantallas completas superpuestas.
- Respetar las zonas seguras (`env(safe-area-inset-*)`) y `viewport-fit=cover`.

**Compatibilidad**: últimas 2 versiones de Chrome, Edge, Firefox y Safari (incluido iOS).

## Plan por fases y criterios de aceptación

Nueve fases en orden; cada una termina con algo que se puede abrir en el navegador y no se pasa a la siguiente sin cumplir sus criterios.

### Fase 0 — Preparación

Repositorio Git, Vite + TypeScript + Preact, estructura de carpetas, ESLint y Prettier, CSV copiado en `data/`.

- [ ] `npm run dev` abre una página vacía sin errores en consola
- [ ] `npm run build` genera `dist/` sin avisos

### Fase 1 — Datos

`build_data.py` con limpieza, macrocategorías, JSON e informe.

- [ ] El informe cuadra: filas leídas = exportadas + excluidas por cada motivo
- [ ] Ningún `id` repetido y `inicio` ≤ `fin` en todas las filas exportadas
- [ ] Las 57 secciones tienen macrocategoría
- [ ] Comprobación manual de 10 eventos al azar contra el CSV

### Fase 2 — Eje básico

Escala lineal y logarítmica, marcas del eje, zoom y desplazamiento, puntos y barras en un solo carril, sin estilos.

- [ ] Zoom desde el rango completo hasta unos 2 meses sin saltos ni errores numéricos
- [ ] Etiquetas correctas en los 7 niveles de escala (tests de `ticks.ts` y `dates.ts`)
- [ ] Big Bang, «6 ka BP» y «jul 1851» aparecen en su sitio en ambos modos de escala
- [ ] 60 fps al hacer zoom con los 10.000 eventos

### Fase 3 — Carriles, agrupación y ficha

12 carriles, apilado, burbujas «+N», etiquetas y ficha del evento.

- [ ] Sin solapes de marcadores ni de etiquetas en ningún nivel de zoom
- [ ] Pinchar una burbuja acerca el zoom o abre la lista agrupada
- [ ] La ficha muestra todos los campos definidos en F7

### Fase 4 — Buscador, filtros y enlaces

- [ ] Buscar «haussmann», «Haussmann» y «hausman» encuentra el mismo evento
- [ ] Los filtros actualizan el eje y el contador al instante
- [ ] Abrir `/#e42` centra el eje en el evento 42 y abre su ficha
- [ ] Al recargar, la vista y los filtros se restauran

### Fase 5 — Estilos por periodo

Los 10 temas, transiciones, texturas, tipografías y selector de estilo.

- [ ] Cada periodo se activa al cruzar su límite, con transición de 600 ms
- [ ] Contraste AA comprobado con una herramienta automática en los 10 temas
- [ ] Los estilos neutro claro y oscuro funcionan

### Fase 6 — Aprender jugando

«¿Qué pasaba a la vez?», «Sorpréndeme», quiz y escala humana.

- [ ] Los contemporáneos de un evento del siglo XIII incluyen eventos de al menos 3 macrocategorías distintas
- [ ] El quiz no repite eventos en una misma ronda y guarda la mejor puntuación

### Fase 7 — Accesibilidad, móvil y rendimiento

- [ ] Toda la web es usable solo con teclado
- [ ] Probado en un iPhone y un Android reales
- [ ] Lighthouse móvil: Performance ≥ 90 y Accessibility ≥ 95

### Fase 8 — Despliegue

- [ ] Enlace público funcionando y abierto desde otro dispositivo
- [ ] Un enlace a evento compartido por WhatsApp abre el evento correcto

## Despliegue y entrega

La web se publica gratis en GitHub Pages y se actualiza sola con cada `git push`; el resultado es un enlace del tipo `https://<usuario>.github.io/cronologia/`.

**Pasos**

1. Crear el repositorio `cronologia` en GitHub.
2. Configurar `base: "/cronologia/"` en `vite.config.ts`.
3. Añadir un workflow de GitHub Actions que ejecute `python scripts/build_data.py` y `npm run build`, y publique `dist/` en Pages.
4. En el repositorio, activar Pages con origen «GitHub Actions».
5. Comprobar el enlace desde el móvil y desde otro navegador.

**Alternativa**: Netlify o Cloudflare Pages, conectando el mismo repositorio; ambos dan enlace propio y HTTPS.

**Actualizar los datos**: sustituir `data/cronologia.csv` y hacer `git push`; el workflow regenera el JSON y republica.

**Al compartir**

- Título y descripción en `<head>` (`og:title`, `og:description`) e imagen de vista previa de 1200 × 630 px, para que el enlace se vea bien en WhatsApp y redes.
- Favicon propio (un reloj de arena o un estrato).

**Privacidad**: sin analítica ni cookies en la v1.

## Instrucciones para Claude Code

Descarga este documento como Markdown, guárdalo en la raíz del proyecto como `docs/PROYECTO.md` junto a `cronologia.csv`, crea el `CLAUDE.md` de abajo y arranca con el primer mensaje.

**`CLAUDE.md`**

```markdown
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

## Comandos
- python scripts/build_data.py → regenera public/data/*.json
- npm run dev → servidor local
- npm test → tests
- npm run build → build de producción
```

**Primer mensaje para Claude Code**

```
Lee CLAUDE.md y docs/PROYECTO.md. Antes de escribir código, resume en 10 líneas qué vas a construir y señala cualquier contradicción o hueco que veas en la especificación. Después ejecuta la Fase 0 y la Fase 1, enséñame el build_report.md y para.
```
