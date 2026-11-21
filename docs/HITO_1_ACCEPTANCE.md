# Informe de aceptación del Hito 1

**21 de noviembre de 2026**

El modelador cumple los requisitos funcionales de cierre verificados. La selección múltiple, el traslado conjunto, el inspector y las interacciones con el lienzo se probaron sobre la compilación de producción. La aceptación formal queda para revisión del responsable del proyecto. El cotejo documental integral sigue pendiente de acceso al documento maestro y a la adenda del 21/11/2026.

## Validación final de la interfaz CAD

El inspector conserva las propiedades, los recuentos y los avisos del modelo. La barra inferior concentra Snap, UCS, cuadrícula visual y atajos. El indicador UCS del lienzo muestra la orientación activa y abre el mismo formulario que el botón de la barra inferior. Se reutilizaron el inspector, los formularios de Snap y UCS, la cuadrícula y los controles de cámara.

| Requisito | Evidencia de implementación | Prueba ejecutada | Resultado | Estado | Observaciones |
| --- | --- | --- | --- | --- | --- |
| Inspector centrado en el modelo | [Inspector](../src/modeler/inspector/Inspector.tsx) | Playwright con selección simple y múltiple, y nudos superpuestos | Propiedades, etiquetas, recuentos y avisos accesibles | Conforme | Los controles globales se abren desde la barra y el lienzo. |
| Menú Snap y cuadrícula visual | [Barra inferior](../src/app/StatusBar.tsx), [menú Snap](../src/app/SnapControls.tsx) y [resolvedor](../src/modeler/tools/snap.ts) | Playwright con F3, F9, tres referencias independientes, pasos X/Y, tolerancia y entrada numérica. Vitest con filtros y apertura visual | Object Snap conserva prioridad y respeta los filtros. La cuadrícula visual se controla de forma independiente | Conforme | Tolerancia de 10 px CSS por defecto, configurable entre 1 y 50 px. |
| UCS único y orientación visible | [Indicador](../src/app/App.tsx) y [formulario UCS](../src/app/UcsForm.tsx) | Playwright modificando el UCS desde el lienzo, consultándolo desde la barra y restableciéndolo | Ambos accesos reflejan el mismo estado. Las coordenadas globales se conservan | Conforme | Se mantienen el origen numérico, la rotación y la elección de origen en el lienzo. |
| Atajos, foco y cierre de menús | [Diálogos](../src/app/WorkspaceDialog.tsx) | Playwright con Enter, Tab, Esc y clic fuera durante selección y movimiento | El foco vuelve al botón. Se conservan la selección y la operación en curso | Conforme | La ayuda reúne los atajos existentes en cinco categorías. |
| Barra y menús en anchuras reducidas | [Estilos](../src/styles.css) | Playwright a 320, 480 y 800 px, más captura a 1920 × 1080 | Controles accesibles, menús dentro de la ventana y ancho sin desplazamiento horizontal | Conforme | El ancho mínimo de la interfaz es 320 px. |
| Regresión de modelado | [Suite funcional](../tests/e2e/hito1.spec.ts) y comparación con el respaldo | Vitest, Playwright, TypeScript y compilación | 47 pruebas Vitest y 14 Playwright aprobadas. Tipos y compilación correctos | Conforme | Se verificaron selección, traslado múltiple, rechazo atómico y superposiciones. Los archivos del dominio y la geometría conservaron su contenido. |

La prueba funcional se ejecutó en Edge para Windows con Node.js 24.22.1. El respaldo local de esta intervención contiene 47 archivos verificados con SHA-256. La captura de la compilación probada se guardó en `.qa.local/aula-estructural-interfaz-hito1.png`.

### Archivos de la reorganización

- **Interfaz** · [App.tsx](../src/app/App.tsx), [Icon.tsx](../src/app/Icon.tsx), [StatusBar.tsx](../src/app/StatusBar.tsx), [WorkspaceDialog.tsx](../src/app/WorkspaceDialog.tsx), [ModelCanvas.tsx](../src/modeler/canvas/ModelCanvas.tsx), [Inspector.tsx](../src/modeler/inspector/Inspector.tsx) y [styles.css](../src/styles.css).
- **Formularios reubicados** · [SnapControls.tsx](../src/app/SnapControls.tsx) y [UcsForm.tsx](../src/app/UcsForm.tsx), antes en el directorio del inspector.
- **Preferencias y pruebas** · [editor.ts](../src/modeler/tools/editor.ts), [snap.ts](../src/modeler/tools/snap.ts), [snap.test.ts](../src/modeler/tools/snap.test.ts) y [hito1.spec.ts](../tests/e2e/hito1.spec.ts).
- **Documentación** · [README](../README.md), [arquitectura](ARCHITECTURE.md) y este informe.

## Línea base y respaldo

El directorio de trabajo carecía de repositorio Git. La línea base pasó 42 pruebas de Vitest, TypeScript y la compilación. La terminal resolvía Node.js 20.18.0 por defecto y las verificaciones se realizaron con Node.js 24.22.1. Se creó un ZIP con los 43 archivos fuente, de configuración y documentación. Cada entrada se cotejó con su archivo de origen mediante SHA-256. El respaldo local es `.qa.local/respaldo-hito1-antes-del-cierre-20261121-070814.zip`.

## Matriz de conformidad

| Requisito | Evidencia de implementación | Prueba ejecutada | Resultado | Estado | Observaciones |
| --- | --- | --- | --- | --- | --- |
| Protección del estado anterior | ZIP del árbol fuente y comprobación de Git | Comparación de 43 entradas con SHA-256 y verificación de la línea base | Respaldo válido y 42 pruebas iniciales aprobadas | Conforme | El proyecto se respalda como archivos. |
| Clic, Ctrl o Cmd, Mayús y Esc | [Gestos del lienzo](../src/modeler/canvas/ModelCanvas.tsx) y [reductor](../src/modeler/tools/editor.ts) | Playwright con clic simple, Ctrl, Mayús repetido y Esc en selección y movimiento | Selección individual, alternancia, adición y cancelación verificadas | Conforme | Ctrl se probó en Edge para Windows. Cmd usa la misma regla mediante `metaKey`. |
| Ventanas y eliminación múltiple | [Selección geométrica](../src/modeler/canvas/selection.ts) y [eliminación en dominio](../src/domain/structure.ts) | Playwright en ambas direcciones con selección mixta y borrado | Inclusión total, intersección y eliminación verificadas | Conforme | Eliminar nudos elimina sus barras incidentes. |
| Traslado de nudos seleccionados | [Traslación de dominio](../src/domain/structure.ts) y [previsualización](../src/modeler/canvas/StructureLayer.tsx) | Vitest y Playwright con dos nudos y una barra seleccionada | Desplazamiento común, IDs y extremos conservados | Conforme | Solo se trasladan nudos seleccionados explícitamente. |
| Rechazo atómico de geometría inválida | [Validación de posiciones y barras incidentes](../src/domain/structure.ts) | Vitest y Playwright con barra que quedaría sin longitud. Vitest con nudo secundario fuera del rango | El documento previo se conserva en ambos casos | Conforme | Se valida la posición final de ambos extremos. |
| Grid Snap y Object Snap | [Resolución de Snap](../src/modeler/tools/snap.ts) y [referencia en el inspector](../src/modeler/inspector/CoordinateForm.tsx) | Playwright con ajuste a cuadrícula y a un extremo existente. Vitest con exclusión del conjunto móvil | El destino ajustado genera un único vector físico | Conforme | Las referencias derivadas de nudos móviles quedan excluidas. |
| Zoom, pan y UCS | [Cámara](../src/geometry/camera.ts), [transformaciones](../src/geometry/coordinates.ts) y [reductor](../src/modeler/tools/editor.ts) | Playwright con zoom y pan antes de confirmar. Playwright con entrada relativa bajo UCS rotado 90° | Se conservaron el destino ajustado y las coordenadas globales esperadas | Conforme | Las entradas numéricas se aplican directamente. |
| Nudos superpuestos y conectividad | [Detección de coincidencias](../src/domain/nodeOverlaps.ts) y [traslación](../src/domain/structure.ts) | Vitest en el límite de 10⁻⁸ m. Playwright superponiendo y separando nudos con barras | El aviso aparece y desaparece. Los nudos conservan IDs independientes | Conforme | Los cruces geométricos conservan las conexiones originales. |
| Inspector múltiple | [Inspector](../src/modeler/inspector/MultiSelection.tsx) y [edición de etiquetas](../src/domain/structure.ts) | Playwright con grupos de nudos, barras y mezcla. Vitest con etiqueta inválida y válida | Recuentos, diferencias, lectura de valores comunes y edición de etiqueta verificados | Conforme | Coordenadas, longitud y orientación se consultan como valores de solo lectura. |
| Suite funcional reproducible | [Configuración Playwright](../playwright.config.ts), [suite](../tests/e2e/hito1.spec.ts) y [dependencias](../package-lock.json) | `npm run test:e2e` con `AULA_E2E_CHANNEL=msedge` | 7 pruebas aprobadas en Microsoft Edge | Conforme | La suite sirve temporalmente la compilación bajo `/aula-estructural/`. |
| Pruebas unitarias, tipos y producción | [Vitest](../vite.config.ts) y [TypeScript](../tsconfig.json) | Vitest, `tsc --noEmit` y `vite build` ejecutado por el script funcional | 45 pruebas aprobadas en 7 archivos. Tipos y compilación correctos | Conforme | Node.js 24.22.1. |
| Hoja de ruta y referencias aprobadas | [Hoja de ruta](DEVELOPMENT_ROADMAP.md), [arquitectura](ARCHITECTURE.md) y [modelo de datos](DATA_MODEL.md) | Revisión frente a las instrucciones de cierre proporcionadas | Hito 2 asignado a apoyos, cargas, menús contextuales y edición avanzada. Hito 3 asignado a persistencia, intercambio y publicación | Parcialmente conforme | El documento maestro y la adenda no estaban disponibles como archivos para realizar el cotejo integral. |

## Archivos incorporados o actualizados

- **Selección y movimiento** · [App.tsx](../src/app/App.tsx), [coordinates.ts](../src/geometry/coordinates.ts), [structure.ts](../src/domain/structure.ts), [editor.ts](../src/modeler/tools/editor.ts), [snap.ts](../src/modeler/tools/snap.ts), [ModelCanvas.tsx](../src/modeler/canvas/ModelCanvas.tsx), [StructureLayer.tsx](../src/modeler/canvas/StructureLayer.tsx) y [CoordinateForm.tsx](../src/modeler/inspector/CoordinateForm.tsx).
- **Inspector** · [Inspector.tsx](../src/modeler/inspector/Inspector.tsx), [MultiSelection.tsx](../src/modeler/inspector/MultiSelection.tsx) y [styles.css](../src/styles.css).
- **Pruebas y configuración** · [editor.test.ts](../src/modeler/tools/editor.test.ts), [snap.test.ts](../src/modeler/tools/snap.test.ts), [hito1.spec.ts](../tests/e2e/hito1.spec.ts), [playwright.config.ts](../playwright.config.ts), [package.json](../package.json), [package-lock.json](../package-lock.json), [tsconfig.json](../tsconfig.json) y [.gitignore](../.gitignore).
- **Documentación** · [README](../README.md), [arquitectura](ARCHITECTURE.md), [modelo de datos](DATA_MODEL.md), [hoja de ruta](DEVELOPMENT_ROADMAP.md) y este informe.

## Limitaciones y riesgos pendientes

- El modelo sigue en memoria durante la sesión. La persistencia y el intercambio corresponden al Hito 3.
- La ejecución funcional se verificó en Microsoft Edge para Windows a 1920 × 1080. El alcance de esta corrida cubre ese navegador y esa resolución.
- Las etiquetas compartidas de hasta 80 caracteres pueden repetirse. Los IDs siguen disponibles en el inspector y en los avisos de superposición.
- El respaldo permite recuperar el estado inicial. Sin repositorio Git, la trazabilidad entre versiones se apoya en respaldos y en este informe.

La matriz sustenta la aceptación funcional del Hito 1 dentro de los requisitos de cierre comprobados. La revisión documental pendiente delimita el alcance de la conformidad. El trabajo termina en el Hito 1.
