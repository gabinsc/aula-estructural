# Hito 2.3 · Cargas estructurales 2D

## Acceso directo a subtipos de apoyo y carga

Los botones principales **Apoyo** y **Carga** abren un menú común anclado al botón. Al abrirlo, el foco pasa al subtipo activo o al primero disponible. Esc devuelve el foco al botón y el clic exterior cierra el menú. Abrirlo conserva la selección y la geometría. Elegir un subtipo conserva un único elemento preseleccionado si es compatible y mantiene la herramienta activa para repetirla sobre otros elementos.

El Inspector usa la selección del menú para inicializar el formulario existente. En apoyos solo el rodillo solicita inclinación. Un tipo diferente para un apoyo existente exige confirmar el reemplazo. En cargas, Fuerza nodal y Momento nodal tienen entradas separadas al crear, y los tres subtipos de barra abren sus campos de posición o intervalo. Los atajos A y C conservan la vía de asignación general por teclado. Los borradores siguen fuera del documento y del historial.

La verificación pasó **82 pruebas Vitest** y **28 Playwright** en Edge para Windows con Node.js 24.22.1. TypeScript y la compilación de producción finalizaron correctamente. Los escenarios nuevos cubren los ocho subtipos, los límites del menú a 320 px, el foco, el cierre externo, la repetición, la cancelación y Undo/Redo. Los escenarios anteriores de carga y apoyo que activaban la herramienta genérica con clic pasan por los atajos equivalentes y conservan sus comprobaciones.

- **Menús y editor.** [ToolMenu.tsx](../src/app/ToolMenu.tsx), [Tools.tsx](../src/app/Tools.tsx), [App.tsx](../src/app/App.tsx), [editor.ts](../src/modeler/tools/editor.ts), [ModelCanvas.tsx](../src/modeler/canvas/ModelCanvas.tsx) y [styles.css](../src/styles.css). El menú anterior `LoadTools.tsx` se sustituyó por el componente compartido.
- **Inspector.** [Inspector.tsx](../src/modeler/inspector/Inspector.tsx), [NodeSupport.tsx](../src/modeler/inspector/NodeSupport.tsx), [LoadInspector.tsx](../src/modeler/inspector/LoadInspector.tsx) y [BarLoadForm.tsx](../src/modeler/inspector/BarLoadForm.tsx).
- **Verificación y uso.** [Pruebas unitarias](../src/modeler/tools/history.test.ts), [Playwright](../tests/e2e/hito1.spec.ts), [README](../README.md) y [guía de cargas](LOADS_USAGE.md).

## Consolidación de la interacción CAD

La revisión partió de cargas nodales, puntuales y distribuidas operativas, representación SVG, gestión desde el Inspector del propietario y Undo/Redo. La línea base de esta intervención reprodujo **71 pruebas Vitest y 22 Playwright**. El directorio sigue sin Git. El respaldo previo consta de 69 archivos cotejados por SHA-256. SHA-256 del ZIP `023816FAB2F37869894AC9D16A0487B58BFF48DE7AD777E3662F60C4F1433CAA`. [Respaldo de la consolidación](../.qa.local/respaldo-antes-consolidacion-2.3-20261121-133644.zip)

### Cambios verificados

- El desplegable **Tipos de carga** abre las cinco opciones aprobadas, con navegación por flechas, Entrar y Esc. La barra señala la herramienta activa. La selección de un propietario válido abre el formulario contextual. La opción Momento nodal presenta Mz, con el signo positivo antihorario.
- Las fuerzas y las intensidades nuevas parten en global a **270°** con magnitud cero, para que el usuario defina el valor. Una magnitud positiva produce `Fx = 0` y `Fy = −P` con ese ángulo. Las cargas guardadas conservan sus valores. Las direcciones cardinales se convierten en componentes exactas y las demás usan seno y coseno. La rueda de cargas nodales y puntuales admite ratón y teclado. Las distribuidas permiten editar ángulo, intensidad y componentes de sus extremos en formato compacto.
- El formulario interpreta las componentes y los ángulos en el marco seleccionado. En local, +X′ sigue la barra desde su extremo inicial y +Y′ apunta 90° en sentido antihorario. Se conserva el modelo anterior de distancias físicas y restricciones de geometría.
- La vista previa usa el mismo dibujo que las cargas guardadas y un estilo provisional. El estado del borrador está separado de `Structure`. Los cambios inválidos ocultan la vista previa. Aceptar registra una sola edición efectiva y Esc o **Cancelar formulario** cierran el borrador.
- El clic identifica las cargas por sus trazos usando una tolerancia de **9 px CSS**. Un clic normal prioriza nudos y barras. Alt + clic prioriza cargas y permite recorrer coincidencias. Los textos del SVG y los borradores quedan fuera del hit test. Las ventanas aplican contención de izquierda a derecha y cruce de derecha a izquierda. Una distribución seleccionada representa una sola entidad aunque tenga muchas flechas. Ctrl/Cmd alterna y Mayús añade sin seleccionar automáticamente al propietario.
- El Inspector muestra el ID, la asociación y los campos del tipo de carga seleccionado. La selección múltiple muestra recuentos y, para grupos de cargas, su tipo y sistema comunes cuando coinciden. Supr o el botón **Eliminar selección** borran la selección mixta como una sola transacción. Undo/Redo conserva los datos físicos y las referencias.

### Matriz de aceptación de la consolidación

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| Dirección inicial, componentes y unidades | Conforme | Vitest verifica 270°, conversiones cardinales, polar oblicua y unidades SI. Playwright introduce 2 kN y comprueba `Fx = 0`, `Fy = −2` y la flecha descendente. |
| Desplegable, formulario contextual y rueda | Conforme | Playwright abre el grupo por teclado, recorre sus opciones, confirma el tipo y comprueba la sincronización entre rueda, ángulo y componentes. |
| Posición e intervalo en previsualización | Conforme | Playwright verifica el borrador de una distribución y el desplazamiento de una carga puntual antes de confirmar. |
| Cancelación e historial | Conforme | Playwright cancela con Esc y comprueba que Deshacer llega a la última geometría confirmada. Vitest verifica que la vista previa conserva ambas pilas. |
| Selección por clic, selección múltiple y mixta | Conforme | Playwright selecciona una carga nodal y una puntual por el trazo, alterna con Ctrl y añade nudo y barra con Mayús. Verifica que una carga individual no selecciona su propietario. |
| Selección de una distribución como unidad | Conforme | Playwright compara una ventana de contención parcial con una ventana de cruce y elimina la distribución completa con Supr. |
| Desambiguación, zoom y paneo | Conforme | Playwright verifica prioridad de la barra y recorre dos cargas puntuales coincidentes con Alt tras zoom y paneo. |
| Edición directa, eliminación y Undo/Redo | Conforme | Playwright edita una carga desde su selección gráfica, deshace el cambio y recupera una distribución borrada. Vitest comprueba el borrado mixto atómico. |
| Ejes globales/locales y conservación de s, s₀ y s₁ | Conforme | Las pruebas anteriores siguen verificando rotación del marco local, distancia física y rechazo atómico al invalidar una posición. |
| Uniformes, triangulares y trapezoidales, apoyos, Snap y UCS | Conforme | Se conservaron las pruebas anteriores, incluidas las de perfiles y signos, nudos superpuestos, apoyo con cargas, Snap y UCS. |
| Acotación dinámica | Mejora independiente | La inspección encontró reglas y previsualización básica de barras, pero ningún módulo de acotación dinámica. Queda registrada en la hoja de ruta. |

### Verificación final

| Comprobación | Resultado |
| --- | --- |
| Vitest | **74 aprobadas** en 11 archivos. |
| Playwright | **25 aprobadas** en Microsoft Edge para Windows sobre la compilación de producción. |
| TypeScript | `tsc --noEmit` sin errores. |
| Producción | `vite build` correcto. |

Se usó Node.js 24.22.1. Se conservaron los escenarios existentes y se añadieron tres de interacción CAD. **Dictamen técnico · Apto para revisión.**

### Archivos de esta intervención

- **Dominio e historial.** [load.ts](../src/domain/load.ts), [structure.ts](../src/domain/structure.ts), [editor.ts](../src/modeler/tools/editor.ts) e [history.ts](../src/modeler/tools/history.ts).
- **Herramientas y lienzo.** [Menú de herramientas](../src/app/ToolMenu.tsx), [Tools.tsx](../src/app/Tools.tsx), [App.tsx](../src/app/App.tsx), [ModelCanvas.tsx](../src/modeler/canvas/ModelCanvas.tsx), [StructureLayer.tsx](../src/modeler/canvas/StructureLayer.tsx), [LoadLayer.tsx](../src/modeler/canvas/LoadLayer.tsx), [loadPicking.ts](../src/modeler/canvas/loadPicking.ts), [selection.ts](../src/modeler/canvas/selection.ts) y [styles.css](../src/styles.css).
- **Inspector y orientación.** [loadDirection.ts](../src/modeler/loadDirection.ts), [DirectionControl.tsx](../src/modeler/inspector/DirectionControl.tsx), [BarLoadForm.tsx](../src/modeler/inspector/BarLoadForm.tsx), [LoadInspector.tsx](../src/modeler/inspector/LoadInspector.tsx), [LoadFields.tsx](../src/modeler/inspector/LoadFields.tsx), [Inspector.tsx](../src/modeler/inspector/Inspector.tsx) y [MultiSelection.tsx](../src/modeler/inspector/MultiSelection.tsx).
- **Pruebas y documentación.** [loadDirection.test.ts](../src/modeler/loadDirection.test.ts), [load.test.ts](../src/domain/load.test.ts), [Playwright](../tests/e2e/hito1.spec.ts), [README](../README.md), [guía de uso](LOADS_USAGE.md), [arquitectura](ARCHITECTURE.md), [hoja de ruta](DEVELOPMENT_ROADMAP.md) y este informe.

### Límites de la consolidación

Los textos y símbolos cercanos aún pueden solaparse. Se pueden distinguir por Alt + clic sobre los trazos o mediante el listado del Inspector. Las cargas se muestrean para selección cuando se cierra un gesto, por lo que las curvas se aproximan mediante segmentos de hasta 3 px. La verificación de interfaz usó Edge para Windows. Se conserva el alcance del Hito 2.3.

## Resumen ejecutivo

El modelador incorpora cargas nodales, fuerzas puntuales en barras y distribuciones uniformes o linealmente variables. Se pueden crear, consultar, editar y quitar como entidades con identidad propia. Todas las ediciones confirmadas quedan en Undo/Redo. **Dictamen técnico · Apto para revisión.**

## Línea base y recuperación

Se inspeccionaron el dominio, los apoyos, la selección geométrica, el lienzo, el Inspector, el historial y los documentos de requisitos. El código activo carecía de entidades de carga y de controles para asignarlas. La línea base reprodujo las **60 pruebas Vitest y 19 Playwright** del Hito 2.2, además de TypeScript y compilación correctos. El directorio carece de Git.

Antes de programar se verificaron las 61 entradas de un respaldo recuperable mediante SHA-256 contra el origen. SHA-256 del ZIP `05127EAEE268B97755B799CA84DA811E078BEE5A66451D6F4299232647E11BB4`. [Respaldo local](../.qa.local/respaldo-antes-hito-2.3-20261121-125754.zip)

## Arquitectura y entidades

El dominio mantiene `Structure.loads` y un contador para emitir IDs `C1`, `C2`, etc. La interfaz envía acciones de edición confirmada al reductor y el lienzo obtiene las cargas del documento. La carga activa y los campos del formulario son estado de interfaz. El dominio y el editor carecen de dependencias de SVG. [Dominio](../src/domain/load.ts) · [Modelo de datos](DATA_MODEL.md) · [Arquitectura](ARCHITECTURE.md)

| Entidad | Asociación | Datos físicos |
| --- | --- | --- |
| Nodal | `nodeId` | Vector `force = (Fx, Fy)` en N y escalar `moment = Mz` en N·m. |
| Puntual | `barId` | Distancia `s` en m desde el extremo inicial, `frame` y `force` en N. |
| Distribuida | `barId` | Extremos físicos `s0`, `s1` en m, `profile`, `frame` y vectores `q0`, `q1` en N/m. |

## Signos y sistemas de coordenadas

X global apunta hacia la derecha, Y global hacia arriba y Mz positivo gira en sentido antihorario. Los formularios presentan kN, kN·m y kN/m. El eje X′ local apunta del nudo inicial al final y Y′ se deriva girando 90° en sentido antihorario. Una fuerza o intensidad local gira con la barra. Una global conserva su dirección. El UCS controla la entrada de geometría y no altera los vectores de carga.

## Representación e interacción

Las cargas nodales usan dos flechas independientes por componentes no nulas y un arco con punta de flecha para el momento. La puntual usa una flecha en la dirección de la resultante y una marca en la distancia `s`. La distribuida usa flechas muestreadas en el intervalo y una envolvente de sus colas. Las longitudes gráficas de una distribución son relativas a su intensidad máxima. Las etiquetas indican magnitudes, signos, unidades y el sistema de una carga sobre barra. La capa SVG no captura eventos del puntero. [Capa de cargas](../src/modeler/canvas/LoadLayer.tsx)

**Carga (C)** reutiliza la selección de nudo o barra. El Inspector lista las cargas del elemento seleccionado. Elegir un ID resalta esa carga y permite editarla o quitarla. La posición puntual muestra también `s/L` en porcentaje. El botón **Usar toda la barra** completa el intervalo físico con la longitud actual. Cambiar de sistema interpreta los valores escritos en los ejes elegidos al confirmar. [Guía con ejemplos](LOADS_USAGE.md)

## Historial y validaciones

- Los comandos comprueban el elemento asociado, las magnitudes finitas y el tipo de carga. La edición conserva la identidad, el tipo principal y el elemento asociado. Un perfil distribuido puede cambiar entre uniforme y variable.
- La carga puntual exige `0 ≤ s ≤ L`. La distribuida exige `0 ≤ s0 < s1 ≤ L` y combina intensidades iguales para el perfil uniforme o distintas para el lineal. Las comparaciones se aplican a la longitud calculada.
- Las distancias físicas permanecen al rotar, acortar o alargar. El dominio valida todas las barras incidentes antes de publicar un traslado. Si una carga quedara fuera, se conserva el documento completo y se informa el ID de la carga y de la barra.
- Borrar una barra elimina sus cargas. Borrar un nudo elimina sus cargas, su apoyo, sus barras incidentes y las cargas de esas barras en la misma transacción. Los nudos superpuestos se gestionan por ID.
- Undo/Redo restaura los datos de carga junto con el documento. Los rechazos, la selección de una carga y las ediciones sin cambios conservan ambas pilas. Una edición efectiva tras Undo descarta Redo. Los campos de texto mantienen su historial nativo.

## Matriz de cumplimiento

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| Cargas nodales múltiples con Fx, Fy y Mz | Conforme | Vitest verifica conversión SI, signos, IDs y asociación. Playwright verifica flechas, arcos de ambos sentidos y selección por ID. |
| Puntuales con distancia física y porcentaje derivado | Conforme | Vitest comprueba extremos e interior. Playwright comprueba que 3 m se conservan al cambiar la longitud y que el porcentaje cambia de 37,5 % a 50 %. |
| Perfil uniforme y variable sobre intervalos físicos | Conforme | Vitest comprueba extremos, interpolación y magnitudes en N/m. Playwright verifica perfiles uniforme, triangular y trapezoidal y sus etiquetas. |
| Transformación global y local | Conforme | Vitest comprueba la rotación vectorial. Playwright gira una barra y compara las direcciones de las flechas global y local. |
| Intervalos y magnitudes válidos | Conforme | Vitest rechaza referencias inexistentes, magnitudes no finitas, distancias e intervalos fuera de rango y extremos incompatibles con el perfil. Playwright comprueba el rechazo del intervalo degenerado. |
| Integridad en movimientos y eliminación | Conforme | Vitest comprueba el rechazo de un traslado conjunto inválido y la independencia de nudos superpuestos. Playwright verifica el bloqueo al acortar y la restauración de cargas y conectividad al deshacer borrados. |
| Creación, modificación, eliminación y restauración | Conforme | Vitest recorre transacciones de carga y comprueba Redo tras un cambio efectivo. Playwright cubre la gestión de cargas y su recuperación en el Inspector y el lienzo. |
| SVG, signos, unidades y selección | Conforme | Playwright verifica magnitudes visibles, sentido de flechas y arcos, el anclaje al modelo y la clase de selección. Los símbolos se dibujan en píxeles CSS y las flechas distribuidas se muestrean según longitud proyectada. |
| Compatibilidad con apoyos, UCS, Snap y selección múltiple | Conforme | Escenarios existentes sin cambios y tres escenarios nuevos sobre cargas. Playwright comprueba apoyos con cargas nodales y selección múltiple, UCS y Snap con cargas distribuidas. |

## Pruebas y correcciones de la implementación inicial

| Verificación | Línea base | Resultado final |
| --- | --- | --- |
| Vitest | 60 aprobadas | **71 aprobadas** en 10 archivos. |
| Playwright | 19 aprobadas | **22 aprobadas** en Edge para Windows sobre la compilación de producción. |
| TypeScript | Correcto | `tsc --noEmit` correcto. |
| Producción | Correcta | `vite build` correcto. |

Entorno con Node.js 24.22.1. Se verificaron las etapas A, B y C en secuencia con Vitest, tipos y el escenario correspondiente de Playwright. En la etapa C, el primer escenario agotó su espera al buscar el selector de tipo por texto exacto de etiqueta. El árbol de accesibilidad exponía correctamente el control como cuadro combinado. Se ajustó el localizador del escenario nuevo al rol y nombre accesibles, y pasaron el escenario y la suite completa. [Pruebas de dominio e historial](../src/domain/load.test.ts) · [Pruebas Playwright](../tests/e2e/hito1.spec.ts)

## Archivos creados y modificados

- **Dominio.** [load.ts](../src/domain/load.ts) y [structure.ts](../src/domain/structure.ts).
- **Editor e historial.** [editor.ts](../src/modeler/tools/editor.ts) e [history.ts](../src/modeler/tools/history.ts).
- **Interfaz y SVG.** [Tools.tsx](../src/app/Tools.tsx), [Icon.tsx](../src/app/Icon.tsx), [WorkspaceDialog.tsx](../src/app/WorkspaceDialog.tsx), [ModelCanvas.tsx](../src/modeler/canvas/ModelCanvas.tsx), [StructureLayer.tsx](../src/modeler/canvas/StructureLayer.tsx), [LoadLayer.tsx](../src/modeler/canvas/LoadLayer.tsx), [Inspector.tsx](../src/modeler/inspector/Inspector.tsx), [LoadInspector.tsx](../src/modeler/inspector/LoadInspector.tsx), [BarLoadForm.tsx](../src/modeler/inspector/BarLoadForm.tsx), [LoadFields.tsx](../src/modeler/inspector/LoadFields.tsx) y [styles.css](../src/styles.css).
- **Pruebas.** [load.test.ts](../src/domain/load.test.ts) y [hito1.spec.ts](../tests/e2e/hito1.spec.ts).
- **Documentación.** [README](../README.md), [Arquitectura](ARCHITECTURE.md), [Modelo de datos](DATA_MODEL.md), [Hoja de ruta](DEVELOPMENT_ROADMAP.md), [Guía de uso](LOADS_USAGE.md) y este informe.

## Riesgos y limitaciones

- Pueden coincidir símbolos o etiquetas si hay varias cargas cercanas. La lista del Inspector permite distinguirlas y editar cada ID.
- Las flechas usan escala gráfica. Las magnitudes físicas se consultan en las etiquetas y el formulario.
- Un intervalo aplicado inicialmente en toda la barra conserva sus extremos físicos si la barra se alarga. Las posiciones de barra se comparan con su longitud de punto flotante sin margen adicional.
- El modelo y el historial viven en memoria durante la sesión. La división y reasignación de cargas, el análisis, las reacciones, los menús contextuales avanzados y la persistencia se reservan para sus respectivos hitos. La intervención concluye en 2.3.
