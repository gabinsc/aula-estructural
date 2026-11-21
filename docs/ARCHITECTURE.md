# Arquitectura

## Módulos

| Ruta | Responsabilidad |
| --- | --- |
| `src/geometry/` | Transformaciones físicas y de cámara, proyecciones y distancias. TypeScript independiente del DOM y de React. |
| `src/domain/` | Entidades e invariantes de nudos, barras, apoyos y cargas, incluidas sus restricciones físicas. |
| `src/modeler/tools/` | Reductor de edición. Mantiene el UCS y las preferencias de Snap y traduce acciones en transiciones de herramienta y operaciones de dominio. |
| `src/modeler/canvas/` | Captura de puntero, paneo, zoom, selección, capas SVG y previsualización. |
| `src/modeler/inspector/` | Entrada numérica de modelado, propiedades del modelo y de la selección, y avisos geométricos. |
| `src/app/` | Composición, selector de modos, teclado y estado de la vista. Contiene la configuración de Snap en la barra inferior y el formulario UCS compartido por la barra y el indicador del lienzo. |

La cámara, el puntero y la cuadrícula pertenecen a la vista. El modelo se actualiza a través de operaciones puras. La misma acción puede recibir un extremo desde un clic o desde el inspector. El primer extremo de una barra se conserva como estado transitorio y los nudos se incorporan al modelo junto con la barra al confirmar el segundo extremo.

## Proyección y selección

La cámara tiene un centro global en metros y una escala en píxeles CSS por metro. Para un punto global `p`, la proyección es `u = ancho/2 + (p.x - centro.x) · escala` y `v = alto/2 - (p.y - centro.y) · escala`. La inversa usa el mismo centro y escala. El origen global y los ejes se proyectan con el resto de la geometría. Las reglas y la cuadrícula se recalculan con los límites visibles.

El zoom calcula el punto global bajo el cursor antes de cambiar de escala y corrige el centro para volver a proyectarlo en el mismo píxel. El paneo modifica el centro según el desplazamiento del puntero. El ajuste de vista toma los límites de los nudos.

La detección en pantalla da prioridad al nudo más cercano dentro de 10 px CSS. Luego comprueba la distancia al segmento de cada barra dentro de 7 px CSS. Las tolerancias físicas se aplican por separado y no dependen del zoom.

## Resolución de puntos

Las herramientas de dibujo, movimiento y referencias usan el mismo resolvedor de puntos globales. La proyección inversa convierte el cursor a metros. Object Snap busca entre las referencias habilitadas con una apertura visual configurable, de 10 píxeles CSS por defecto. Grid Snap redondea X e Y desde el origen global cuando corresponde. La cámara convierte el resultado para mostrar el marcador. La barra de estado y la confirmación utilizan ese mismo resultado. La entrada numérica entra al reductor directamente.

Los extremos, puntos medios e intersecciones son referencias estáticas que se recalculan al editar el modelo. Al mover un nudo se excluyen las referencias construidas a partir de él. Futuros candidatos dependientes del cursor, como Nearest y Perpendicular, pueden usar la proyección de segmentos de `src/geometry/segments.ts` y pasar por el mismo arbitraje.

En un movimiento múltiple el destino ajustado se resuelve para un único nudo de referencia. Las referencias de Object Snap que dependen de cualquier nudo movido quedan excluidas. El dominio y la previsualización usan la misma traslación desde la referencia. El dominio valida las posiciones finales y las barras incidentes antes de publicar el nuevo documento en memoria.

La selección múltiple se expresa como una colección de identificadores. El inspector deriva los valores comunes y modifica las etiquetas por identificador. La edición de etiquetas conserva la geometría y la conectividad.

## Controles del espacio de trabajo

El inspector presenta el modelo, la selección, los formularios de coordenadas y los avisos geométricos. La barra inferior concentra el estado y los accesos a la cuadrícula visual, Snap, UCS y atajos. La visibilidad de la cuadrícula pertenece a la vista. El reductor conserva una sola configuración de Snap y un solo marco UCS.

El indicador del lienzo y el botón de la barra inferior abren el mismo formulario UCS. La aplicación guarda por separado el panel abierto y el botón de origen para posicionar el menú y devolver el foco. Los diálogos aíslan sus interacciones del lienzo. Esc y el clic fuera cierran el panel sin ejecutar una acción de modelado.

### Apoyos nodales

La herramienta Apoyo reutiliza la selección geométrica de nudos. El Inspector mantiene el tipo y el ángulo en un borrador local hasta que el usuario confirma. El dominio valida la existencia del nudo, el apoyo esperado y la inclinación. Una edición aplicada publica un nuevo modelo con el apoyo asociado al ID del nudo.

La capa SVG proyecta el centro del nudo y dibuja el símbolo con tamaño fijo en píxeles CSS. En el rodillo invierte el signo del ángulo global por el eje Y de pantalla. La selección sigue usando los nudos y barras originales. Durante el movimiento se dibuja una previsualización del apoyo desde la posición provisional del nudo.

### Cargas estructurales

La herramienta Carga reutiliza la selección geométrica de nudos y barras. El Inspector gestiona borradores numéricos en unidades visibles y muestra únicamente las cargas del elemento seleccionado. El ID de carga activa destaca su símbolo y pertenece al estado transitorio del editor. Guardar y quitar cargas pasan por el reductor y las validaciones de dominio. La eliminación de entidades limpia las cargas dependientes y el traslado valida todos los tramos afectados como parte de la operación geométrica.

La capa SVG proyecta anclajes y tramos desde la geometría física, gira los vectores locales con la barra e invierte el eje vertical para la pantalla. Las flechas y los textos se dimensionan en píxeles CSS. La capa deja pasar los eventos del puntero y la selección geométrica se conserva para nudos y barras.

Un borrador válido se comparte entre el Inspector y el lienzo mediante el estado transitorio del editor. El historial sigue tomando decisiones por identidad de `Structure`. El hit test consulta únicamente trazos de cargas confirmadas proyectados a pantalla. Usa la prioridad de nudos y barras existente, admite selección explícita de cargas solapadas y aplica las mismas reglas de contención y cruce de la ventana CAD.

## Historial de edición

El [reductor de historial](../src/modeler/tools/history.ts) delega cada acción al reductor de edición. Una referencia nueva de `Structure` indica que el dominio confirmó una modificación. El historial conserva hasta 100 versiones anteriores del modelo en memoria. Cada versión contiene nudos, barras, apoyos, cargas, asignaciones mecánicas y contadores, y comparte las colecciones que la operación dejó intactas. El mismo historial restaura las transacciones mecánicas individuales y en lote.

Una barra y sus extremos nuevos, un traslado conjunto, un cambio de apoyo o un borrado con su apoyo y barras incidentes se registran en un solo paso. El destino numérico y el clic confirman la misma operación. La rama de rehacer se descarta al confirmar una modificación nueva. Las previsualizaciones, los errores y las acciones sin cambios efectivos conservan ambas pilas.

Al restaurar una versión, el reductor vuelve a Seleccionar y conserva los elementos de la selección actual que siguen existiendo. Las advertencias de superposición se recalculan a partir de las coordenadas restauradas. La cámara, el UCS y Snap conservan su configuración actual. El historial se pierde al recargar la aplicación.

## Edición avanzada

Las operaciones puras de portapapeles, división e inversión producen un documento completo. La interfaz ofrece comandos de puntero, formularios o acciones de contexto que delegan al editor. Las cotas derivan de geometría física y del ajuste de cursor. El portapapeles y las previsualizaciones viven en el estado de sesión.

## Persistencia local

`src/projects/document.ts` valida el documento y migra los esquemas 1 y 2 a v3. IndexedDB conserva la versión 1 de la base y sus almacenes. Los registros previos se validan y migran en memoria al leer. Al guardar se escribe v3 con la revisión esperada. La biblioteca forma parte de `Structure` y del historial. Importar valida la geometría y sus referencias antes de guardar y asigna un ID nuevo si el original está ocupado. La cámara, UCS, Snap, caso de cálculo, selección, historial y resultados pertenecen a la sesión. [Biblioteca y migración v3](HITO_5_2_MATERIAL_LIBRARY.md)

## Integración de análisis

`Structure.mechanics` es la única fuente de asignaciones. El Inspector conserva un borrador transitorio hasta la confirmación. El dominio valida el lote, mantiene los campos no editados y publica una sola instantánea. Copia, división y borrado actualizan las referencias en la misma operación geométrica.

`src/projects/analysisInput.ts` valida y prepara una instantánea para el motor. `useAnalysis` ejecuta `solveAnalysis` en un Worker de módulo y coteja el identificador de petición y la revisión semántica antes de aceptar el resultado. Esta revisión abarca geometría, conectividad, apoyos, cargas, propiedades y caso. La revisión de IndexedDB protege escrituras.

El panel de resultados consume la traza y los valores del motor, utiliza el selector CAD compartido para resaltar entidades y permite consultar matrices por bloques. Las secciones se evalúan con `evaluateFrameSection`. [Contrato, aceptación y evidencia](HITO_4_4_4_5_INTEGRATION.md)
