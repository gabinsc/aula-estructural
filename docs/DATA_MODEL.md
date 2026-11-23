# Modelo de datos

| Entidad | Campos |
| --- | --- |
| Nudo | `id`, `label`, `x`, `y`. Las coordenadas son globales y se almacenan en metros. |
| Barra | `id`, `label`, `startId`, `endId`, `releaseI` y `releaseJ` opcionales para pórticos. Longitud, orientación y ejes locales se derivan de las posiciones de sus nudos. |
| Apoyo nodal | `nodeId`, `kind` y, únicamente para rodillo, `surfaceAngle` en radianes globales. |
| Carga nodal | `id`, `kind: nodal`, `nodeId`, `force` en N y `moment` en N·m. |
| Carga puntual de barra | `id`, `kind: point`, `barId`, `s` en m, `frame` y `force` en N. |
| Carga distribuida | `id`, `kind: distributed`, `barId`, `s0` y `s1` en m, `frame`, `profile` y vectores `q0` y `q1` en N/m. |
| Modelo en memoria | Colecciones de nudos, barras, apoyos y cargas, con contadores de IDs para nudos, barras y cargas. |

Las coordenadas deben ser finitas y estar dentro de ±10⁹ m por eje. La longitud de una barra debe ser mayor que 10⁻⁸ m, sujeta a la precisión de punto flotante. Un punto introducido por el editor puede reutilizar un nudo de coordenadas idénticas o el ID del extremo obtenido mediante Object Snap. Una barra conecta nudos distintos y cada par de nudos admite una barra en este hito. Un cruce geométrico conserva la conectividad existente. Al mover un nudo se conserva su ID y se comprueba la longitud de las barras incidentes. Al borrar una barra se conservan sus extremos. Al borrar un nudo se eliminan las barras incidentes.

La advertencia de nudos superpuestos se deriva de la distancia euclidiana entre sus coordenadas globales. Se activa a una distancia de **10⁻⁸ m o menos**, con una tolerancia propia e independiente de los píxeles de Object Snap. Si varias coincidencias directas forman una cadena, el lienzo y el inspector muestran un aviso para ese conjunto. El aviso se recalcula al cambiar los nudos. Cada nudo conserva su ID y las barras conservan sus referencias originales.

El movimiento múltiple aplica el vector global desde la referencia hasta su destino a cada nudo explícitamente seleccionado. La validación usa las posiciones finales de ambos extremos de las barras incidentes. Un desplazamiento inválido se rechaza en bloque.

La etiqueta es un texto de 1 a 80 caracteres que el inspector puede aplicar a toda una selección. Varias entidades pueden compartir la misma etiqueta y sus identificadores únicos siguen determinando la conectividad.

## Apoyos nodales

El ID del nudo identifica su único apoyo y se mantiene al cambiar el tipo o la inclinación. Asignar, reemplazar o quitar un apoyo exige confirmar el estado esperado. Mover un nudo mantiene su referencia al apoyo. Borrar un nudo elimina su apoyo y sus barras incidentes en la misma operación. Los nudos superpuestos conservan apoyos independientes por ID.

| Tipo | Grados de libertad restringidos | Grados de libertad permitidos |
| --- | --- | --- |
| Articulado | Traslación en X e Y globales | Rotación |
| Rodillo | Traslación normal a la superficie | Traslación tangencial y rotación |
| Empotrado | Traslación en X e Y globales y rotación | Ninguno |

El ángulo dirigido `θ` del rodillo se mide en sentido antihorario desde +X global y se normaliza a `(−π, π]`. La tangente unitaria es `(cos θ, sin θ)` y la normal restringida es `(−sin θ, cos θ)`. Una rotación de 180° conserva el eje físico restringido e invierte el lado dibujado de la superficie. El ángulo se presenta en grados y el UCS no interviene en su almacenamiento ni en la proyección del apoyo.

La ecuación de la restricción es `nₓuₓ + nᵧuᵧ = 0`. Su dirección normal forma el ángulo `θ + π/2` desde +X global. Al comparar dos inclinaciones, el dominio usa la diferencia angular más corta y considera equivalentes las diferencias de hasta `2π × Number.EPSILON` rad. Este margen solo se emplea para reconocer ediciones sin efecto. En ese caso se conserva el valor almacenado y el historial.

## Sistemas de coordenadas

- **Global.** Posiciones físicas absolutas. X crece a la derecha e Y hacia arriba.
- **UCS.** Marco de entrada con origen global `O` y rotación `θ`. La posición física de una entrada `q` es `O + R(θ)q`. Para consultar la posición en el UCS se resta `O` y se aplica `R(−θ)`. Editar el UCS conserva la geometría global.
- **Relativo.** El vector de entrada se orienta con los ejes UCS y se suma a la posición global del primer extremo.
- **Polar.** Con distancia `r` y ángulo `α`, el vector relativo es `(r cos α, r sin α)`, orientado respecto de los ejes UCS.
- **Local de barra.** El origen es el nudo inicial, X apunta hacia el nudo final e Y se obtiene mediante un giro de 90° antihorario.

## Unidades y signos

Las coordenadas físicas se guardan en metros, las fuerzas en newtons, los momentos en newton-metro y los giros en radianes. El Inspector presenta los ángulos en grados y los resultados presentan las traslaciones en mm, las fuerzas en kN y los momentos en kN·m. La rotación positiva es antihoraria. [Convenciones de extremos y secciones](HITO_4_3_FRAME_ENGINE.md#recuperación-de-esfuerzos-y-desplazamientos)

## Cargas estructurales

Cada carga conserva su ID al editarse. Varios registros pueden referirse al mismo nudo o barra. Las cargas nodales usan coordenadas globales. En cargas de barra `frame` admite `global` y `local`. Para una barra con orientación `θ`, el vector local se transforma con la rotación `R(θ)` y el vector global se conserva. La posición siempre se mide desde el nudo inicial de la barra.

La carga puntual guarda `0 ≤ s ≤ L` y deriva `t = s/L` para consulta. La distribuida guarda `0 ≤ s0 < s1 ≤ L`. Con `u = (s − s0) / (s1 − s0)`, la intensidad es `(1 − u)q0 + u q1`. El perfil uniforme exige extremos iguales y el lineal exige extremos distintos. La interfaz convierte kN a N, kN·m a N·m y kN/m a N/m al confirmar.

Al mover los nudos se valida la geometría final de las barras incidentes y sus cargas antes de publicar el modelo. Si una distancia o intervalo queda fuera, se rechaza todo el traslado. Al ampliar una barra, un intervalo antes completo conserva su extremo físico original. Al borrar un nudo o barra se eliminan todas las cargas que perderían su propietario. La coincidencia geométrica conserva las asociaciones por ID.

Al dividir una barra, la carga puntual se reasigna al tramo correspondiente conservando el ID y la posición física. Si coincide con el corte, pasa al nudo con vector global. Las distribuciones se restringen a cada tramo y se interpolan en el corte. La inversión de barra transforma las distancias y cambia de signo ambas componentes locales. El pegado remapea todos los IDs del conjunto y conserva la conectividad interna.

## Documento persistente

El esquema JSON 2 conserva `schemaVersion`, `id`, `name`, `createdAt`, `modifiedAt`, `model` y `view`. Añade `model.mechanics` con `version: 1` y `assignments`. Cada asignación se identifica por `barId` y declara `kind` como `truss2d` o `frame2d`. Los campos opcionales `E`, `A` e `I` se almacenan en Pa, m² y m⁴. Toda propiedad presente es finita y mayor que cero. Solo los pórticos admiten I. El análisis exige E y A en cada barra e I para cada pórtico.

La migración de v1 conserva identidad, fechas, geometría, cargas, apoyos, contadores y preferencias e inicializa `mechanics.assignments` vacío. El esquema v3 añadió `model.library` y referencias opcionales `materialId`, `sectionId` y `sectionAxis`. El esquema v4 añadió `design` con resistencias en Pa por ID de material y un criterio opcional en Pa o m. El esquema v5 agrega `design.steel` con parámetros por ID de barra. El esquema v6 incorpora liberaciones i/j opcionales. Los proyectos previos migran con extremos rígidos. Al migrar se conservan los valores manuales. Al importar se conserva el ID del proyecto si está libre. Si ya está ocupado, se crea una copia con ID nuevo. IndexedDB conserva su revisión de concurrencia fuera del JSON. [Diseño y versión 4](HITO_8_1_DESIGN_FOUNDATIONS.md) · [Acero y versión 5](HITO_8_2_STEEL_DESIGN.md) · [Ejemplos v1](../examples/)
