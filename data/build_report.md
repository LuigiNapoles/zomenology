# Informe de construcción de datos

Generado: 2026-11-11 · Fuente: `data/cronologia.csv`

## Recuento

| Concepto | Filas |
| --- | ---: |
| Filas leídas | 10.872 |
| Exportadas al eje (`events.json`) | 10.030 |
| Exportadas sin fecha (`undated.json`, solo buscador) | 114 |
| Excluidas: Duplicado (`duplicado_de` relleno) | 728 |
| **Suma** | **10.872** |

Cuadra: **sí** (10.030 + 114 + 728 = 10.872).

## Correcciones aplicadas (filas exportadas)

| Corrección | Filas | ids |
| --- | ---: | --- |
| Rango abierto («6 ka BP-»): `fin` = `inicio`, `x`=1 | 27 | 169, 757, 758, 1431, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018 … |
| Solo fecha de final («-1560»): punto en el final, aproximada, `x`=2 | 19 | 980, 1198, 1328, 1586, 2726, 2763, 2787, 2826, 2867, 2888, 4506, 5359 … |
| Revisión menor («era supuesta»): marcada como aproximada | 10 | 7135, 7136, 7137, 7138, 7139, 7140, 7141, 7142, 7143, 7144 |
| Revisión menor («escala supuesta»): marcada como aproximada | 6 | 6907, 7706, 7825, 10319, 10483, 10861 |
| Revisión menor («formato complejo»): marcada como aproximada | 3 | 4783, 4982, 5131 |
| Revisión menor («fecha con alternativas»): marcada como aproximada | 2 | 8256, 8870 |
| Día leído como año («30/03-22/05/1282»): `inicio` = 1282, 30 de marzo | 1 | 2869 |
| Día leído como mes («10-11/06/1329»): inicio el 10 de junio | 1 | 6121 |
| Inicio posterior al fin: se intercambian `inicio` y `fin` | 1 | 10744 |

Eventos del eje marcados como aproximados (`ap`=1): 1.657.

Etiquetas de sección corregidas: «Contempt» → «Contemporánea», «Moerna» → «Moderna».

## Por macrocategoría

| # | Macrocategoría | Secciones | Eje | Sin fecha |
| ---: | --- | ---: | ---: | ---: |
| 0 | Tiempo profundo | 1 | 408 | 0 |
| 1 | Paleolítico | 2 | 658 | 0 |
| 2 | Neolítico | 4 | 751 | 3 |
| 3 | Próximo Oriente antiguo | 8 | 1.054 | 35 |
| 4 | Antigüedad | 7 | 1.360 | 1 |
| 5 | Mundo clásico | 7 | 1.175 | 25 |
| 6 | Edad Media | 9 | 2.024 | 42 |
| 7 | Edad Moderna | 3 | 599 | 0 |
| 8 | Edad Contemporánea | 2 | 473 | 0 |
| 9 | Mundo extraeuropeo | 4 | 723 | 2 |
| 10 | Geografía | 3 | 477 | 1 |
| 11 | Temas | 7 | 328 | 5 |
| | **Total** | **57** | **10.030** | **114** |

## Por sección

| Sección (etiqueta) | Macrocategoría | Eje | Sin fecha |
| --- | --- | ---: | ---: |
| Prehistoria (-2'58 Ma) | Tiempo profundo | 408 | 0 |
| Paleolítico Final (44'9-11'7 ka BP) | Paleolítico | 267 | 0 |
| Paleolítico Inicial-Medio (2'57 Ma - 45 ka BP) | Paleolítico | 391 | 0 |
| Neolítico final (4499-3300) | Neolítico | 263 | 1 |
| Neolítico inicial (-5500) | Neolítico | 183 | 1 |
| Neolítico inicial (11'6 - 7'5 ka BP) | Neolítico | 106 | 0 |
| Neolítico medio (5499-4500) | Neolítico | 199 | 1 |
| Antigua próx oriente (1068-656) (XXI-XXV) | Próximo Oriente antiguo | 197 | 4 |
| Antigua próx oriente (1291-1069) (XIX-XX) | Próximo Oriente antiguo | 115 | 3 |
| Antigua próx oriente (1649-1292) (XIV-XVIII) | Próximo Oriente antiguo | 172 | 20 |
| Antigua próx oriente (2180-1650) (VII-XIII) | Próximo Oriente antiguo | 299 | 5 |
| Antigua próx oriente (3299-2181) (00-VI) | Próximo Oriente antiguo | 239 | 2 |
| Antigua próx oriente (331-30) (XXXII) | Próximo Oriente antiguo | 8 | 0 |
| Antigua próx oriente (524-332)(XXVII-XXXI) | Próximo Oriente antiguo | 19 | 1 |
| Antigua próx oriente (655-525) (XXVI) | Próximo Oriente antiguo | 5 | 0 |
| Antigua (1199-800) | Antigüedad | 213 | 1 |
| Antigua (1499-1200) | Antigüedad | 140 | 0 |
| Antigua (1999-1500) | Antigüedad | 169 | 0 |
| Antigua (2499-2000) | Antigüedad | 145 | 0 |
| Antigua (3299-2500) | Antigüedad | 225 | 0 |
| Antigua (449-) | Antigüedad | 275 | 0 |
| Antigua (799-450) | Antigüedad | 193 | 0 |
| Clásica (-1400) | Mundo clásico | 103 | 0 |
| Clásica (1180-800) | Mundo clásico | 136 | 2 |
| Clásica (1399-1180) | Mundo clásico | 206 | 2 |
| Clásica (29 a.c-) | Mundo clásico | 215 | 14 |
| Clásica (322-30) | Mundo clásico | 112 | 0 |
| Clásica (499-323) | Mundo clásico | 185 | 3 |
| Clásica (799-500) | Mundo clásico | 218 | 4 |
| Medieval (477-600) | Edad Media | 127 | 12 |
| Medieval (IX) | Edad Media | 220 | 12 |
| Medieval (VII-VIII) | Edad Media | 273 | 9 |
| Medieval (X) | Edad Media | 189 | 4 |
| Medieval (XI) | Edad Media | 213 | 2 |
| Medieval (XII) | Edad Media | 251 | 1 |
| Medieval (XIII) | Edad Media | 302 | 1 |
| Medieval (XIV) | Edad Media | 258 | 0 |
| Medieval (XV) | Edad Media | 191 | 1 |
| Moderna (1492-1550) | Edad Moderna | 185 | 0 |
| Moderna (1551-1648) | Edad Moderna | 197 | 0 |
| Moderna (1649-1789) | Edad Moderna | 217 | 0 |
| Contemporánea (1790-1850) | Edad Contemporánea | 304 | 0 |
| Contemporánea (1851-) | Edad Contemporánea | 169 | 0 |
| América (1d.c-) | Mundo extraeuropeo | 285 | 0 |
| Asia (1 d.C-) | Mundo extraeuropeo | 61 | 1 |
| Historia extraeuropea (-1 a.C) | Mundo extraeuropeo | 185 | 0 |
| África (1 d.C-) | Mundo extraeuropeo | 192 | 1 |
| Geografía (-1900) | Geografía | 112 | 0 |
| Geografía (1901-1950) | Geografía | 94 | 0 |
| Geografía (1951-2026) | Geografía | 271 | 1 |
| Biblia | Temas | 41 | 5 |
| Ciencia aplicada (ingeniería y tecnología) | Temas | 44 | 0 |
| Ciencia pura y medicina | Temas | 38 | 0 |
| Historia Arte | Temas | 29 | 0 |
| Historia España | Temas | 40 | 0 |
| Historia Literatura | Temas | 35 | 0 |
| Historia, filosofía y pensamiento | Temas | 101 | 0 |

## Forma de los datos del eje

- Puntos (`inicio` = `fin`): 2.117 · Barras: 7.913
- Rango: -13.800.000.000 a 2.026

## Tamaño de los archivos

| Archivo | Sin comprimir | gzip |
| --- | ---: | ---: |
| `events.json` | 1.371 KB | 355 KB |
| `undated.json` | 18 KB | 7 KB |
