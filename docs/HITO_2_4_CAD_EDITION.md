# Hito 2.4 · Edición CAD avanzada

## Resumen y línea base

La edición avanzada incorpora selección de cargas por trazo, menús contextuales, copia y pegado de conjuntos, división e inversión de barras, y cotas dinámicas y de visualización. Las operaciones geométricas se validan antes de publicar una versión del modelo y se deshacen como transacciones completas.

La línea base tenía 82 pruebas Vitest y 28 Playwright satisfactorias. Tras verificar los 74 archivos del respaldo por SHA-256, se inicializó Git local y se registró el punto de referencia `f676688`. El repositorio carece de remoto. [Respaldo previo](../.qa.local/respaldo-antes-hito-2.4-20261121-140252.zip)

## Operaciones e interfaz

- El clic normal prioriza el marcador de nudo, el trazo de carga y finalmente la geometría de barra. Alt + clic recorre cargas coincidentes. En una carga sobre una barra el menú contextual ofrece acciones explícitas para esa barra.
- El menú contextual distingue el comando activo, objetos individuales, selección múltiple y lienzo vacío. Abrirlo conserva la selección. Las operaciones sobre un objeto ajeno a la selección actúan sobre esa referencia. El menú de carga superpuesta ofrece acceso explícito a la barra subyacente.
- Copiar recoge los extremos de las barras aunque solo se hayan seleccionado barras. El conjunto incluye sus apoyos y cargas dependientes. Pegar genera nuevos IDs y remapea referencias. Se aplica una traslación desde el primer nudo copiado y se puede indicar el origen mediante Snap o un desplazamiento numérico en UCS. Las cargas seleccionadas sin geometría requieren elegir explícitamente un propietario compatible.
- Dividir crea un nudo independiente incluso si coincide geométricamente con otro. Se emiten dos IDs de barra nuevos. Los apoyos originales siguen anclados a sus nudos. Cada carga puntual mantiene su ID, se reasigna al tramo correspondiente o se convierte en carga nodal con vector global y momento cero si está a hasta 10⁻⁸ m del corte. La tolerancia se acota a la mitad del tramo menor.
- Para una distribución se toma la intersección con cada tramo y se interpolan las intensidades en los extremos del subintervalo. La primera parte conserva el ID, la segunda recibe uno nuevo cuando el intervalo cruza el corte. El ejemplo de 8 m dividido a 3 m conserva los perfiles 10 a 17,5 y 17,5 a 30 kN/m y preserva la resultante y el momento estático a la precisión de la prueba.
- Invertir conserva el ID de barra. Se sustituye `s` por `L − s`, se intercambian los extremos de cada distribución y las componentes locales cambian de signo. La dirección global y el punto físico de aplicación se preservan.
- Las cotas derivan de coordenadas globales y del destino ajustado. Con UCS girado se identifican por separado los componentes y el ángulo de trabajo. La barra inferior controla las cotas de barras existentes. Las cotas y vistas previas pertenecen a la vista y no entran al historial.

## Archivos principales

- [División e inversión](../src/domain/barEdition.ts), [clipboard](../src/domain/clipboard.ts) y [reductor](../src/modeler/tools/editor.ts).
- [Lienzo](../src/modeler/canvas/ModelCanvas.tsx), [acciones contextuales](../src/modeler/canvas/cadActions.ts), [menú](../src/modeler/canvas/CadContextMenu.tsx), [formulario de división](../src/modeler/inspector/SplitForm.tsx) y [cotas](../src/modeler/canvas/Dimensions.tsx).
- [Pruebas matemáticas](../src/domain/cadEdition.test.ts), [pruebas de cotas](../src/modeler/canvas/Dimensions.test.ts), [historial](../src/modeler/tools/history.test.ts) y [escenarios integrados](../tests/e2e/hito1.spec.ts).

## Matriz de aceptación

| Requisito | Evidencia | Estado |
| --- | --- | --- |
| Menús de apoyo y carga | Escenarios de tres y cinco subtipos, Escape y pantalla de 320 px. | Conforme |
| Prioridad de selección y desambiguación | Escenarios por trazo, ventanas, selección mixta y Alt tras zoom y pan. | Conforme |
| Menú contextual sin efectos al abrir | Escenario integrado comprueba recuentos y cierre mediante Escape. | Conforme |
| Copia de nudo, conjunto, cargas y apoyos | Vitest compara geometría y referencias, incluye propietario incompatible y coordenadas fuera del modelo. Playwright comprueba pegado y recuperación. | Conforme |
| División y conservación de acciones | Vitest cubre cargas antes, después y en el corte, perfiles parciales, resultante y momento. Playwright comprueba conversión y restauración. | Conforme |
| Inversión | Vitest compara fuerzas oblicuas globales y locales, distribución uniforme y variable. Playwright comprueba el intercambio y Undo. | Conforme |
| Cotas, Snap y UCS | Vitest comprueba horizontal, vertical e inclinada. Playwright verifica destino ajustado, UCS girado, cancelación, zoom y modos. | Conforme |
| Historial y regresión | Vitest recorre operaciones y compara las versiones; Playwright ejecuta la suite anterior con los puntos de clic actualizados para la nueva prioridad. | Conforme |

## Límites

Las etiquetas de cotas existentes se filtran por espacio para reducir solapamientos en modelos densos. El menú de comando ofrece acciones disponibles según su fase. Repetir vuelve a abrir los comandos de nudo, barra o traslado. El portapapeles funciona dentro de la sesión. Las cargas seleccionadas con geometría deben pertenecer al conjunto copiado y se copian por separado si su propietario no está incluido.

**Verificación:** 89 Vitest, 30 Playwright en Edge para Windows, TypeScript y producción correctos. Se corrigieron tres coordenadas de prueba que seguían esperando la prioridad de barra sobre las cargas. Las verificaciones de selección, propiedades y eliminación se conservaron y se añadieron pruebas de la nueva prioridad. **Dictamen · Apto con observaciones.**

## Capturas

- [Modelo de aceptación](media/hito-2.4-edicion.png)
- [Cotas durante el dibujo con UCS girado](media/hito-2.4-cotas.png)
- [Vista previa de pegado](media/hito-2.4-pegar.png)
- [Formulario de división](media/hito-2.4-dividir.png)
