# Auditoría final de aceptación del Hito 1

**21 de noviembre de 2026 · Aula Estructural**

## 1. Resumen ejecutivo

**Dictamen técnico · APTO PARA CIERRE CON OBSERVACIONES NO BLOQUEANTES.** Se incorporaron y cotejaron las dos fuentes oficiales. Las pruebas y la evidencia de navegador respaldan la validación funcional del Hito 1. Quedan dos diferencias de presentación consignadas en la matriz.

Las fuentes del 21/11/2026 se conservaron íntegras en docs/requisitos/. La respuesta contenía dos copias idénticas de la adenda, verificadas carácter por carácter. Se archivó una. La matriz cruza ambos documentos con las instrucciones específicas de implementación y cierre. [Documento maestro](requisitos/DOCUMENTO_MAESTRO_2026-11-21.md) · [Adenda](requisitos/ADENDA_REQUISITOS_2026-11-21.md) · [Informe anterior](HITO_1_ACCEPTANCE.md)

## 2. Arquitectura verificada

- **Dominio y geometría.** Los nudos guardan coordenadas globales en metros y las barras referencian extremos por ID. Longitud, orientación y ejes locales se calculan a partir de esos extremos. La cámara y la proyección a píxeles se mantienen separadas del documento estructural. [Dominio](../src/domain/structure.ts) · [Coordenadas](../src/geometry/coordinates.ts) · [Cámara](../src/geometry/camera.ts)
- **Editor y presentación.** El reductor reúne modelo, herramienta, selección, Snap y UCS. La vista mantiene cámara, cursor, cuadrícula visible y panel abierto. El inspector deriva las propiedades del modelo y ambos accesos UCS abren el mismo formulario. [Reductor](../src/modeler/tools/editor.ts) · [Aplicación](../src/app/App.tsx)
- **Plataforma y dependencias.** El archivo de bloqueo fija React y React DOM 19.3.1, TypeScript 5.9.3, Vite 8.3.8, Vitest 4.1.12 y Playwright 1.65.1. El modelador usa SVG y TypeScript estricto. Vite sirve una compilación estática bajo la subruta del proyecto. [Manifiesto](../package.json) · [Archivo de bloqueo](../package-lock.json) · [Vite](../vite.config.ts)
- **Almacenamiento y trazabilidad.** El documento se mantiene en memoria durante la sesión. El directorio carece de repositorio Git. Los respaldos locales documentados permiten recuperar estados anteriores. [Arquitectura](ARCHITECTURE.md) · [Informe anterior](HITO_1_ACCEPTANCE.md)

## 3. Matriz de requisitos y evidencias

**CONFORME** indica evidencia suficiente para el requisito identificado. **PARCIALMENTE CONFORME** registra una desviación acotada o una comprobación incompleta. **NO CONFORME** se reserva para un incumplimiento demostrado. **NO VERIFICABLE** indica que falta la fuente necesaria para emitir un juicio.

| Requisito | Evidencia y comprobación | Estado |
| --- | --- | --- |
| Configuración modular, compilación, pruebas y documentación inicial | Se revisaron React, Vite, Vitest, TypeScript estricto, AGENTS, README y los documentos de arquitectura, datos y hoja de ruta. Pasaron tipos, pruebas y compilación. [Configuración TS](../tsconfig.json) · [README](../README.md) | CONFORME |
| Preparación para GitHub Pages | Vite genera la compilación estática con base /aula-estructural/. La vista previa de producción respondió en esa ruta y cargó en los flujos del navegador. [Configuración de Vite](../vite.config.ts) | CONFORME |
| Espacio CAD y selector preliminar Aprender/Resolver | Inspección visual de barra superior, herramientas, lienzo, inspector y estado. El selector indica el modo y ambos comparten las herramientas. La diferenciación funcional de la adenda §2 queda para una etapa posterior. [Aplicación](../src/app/App.tsx) · [Hoja de ruta](DEVELOPMENT_ROADMAP.md) | CONFORME |
| Lienzo SVG, ejes, origen, cuadrícula, reglas y coordenadas del cursor | Observados en la vista de producción. Vitest verifica la transformación inversa entre mundo y pantalla. [Lienzo](../src/modeler/canvas/ModelCanvas.tsx) · [Pruebas de cámara](../src/geometry/camera.test.ts) | CONFORME |
| Zoom anclado, paneo, ajuste y conservación de coordenadas | Ajuste comprobado manualmente. Vitest y Playwright verifican zoom, paneo y conservación de las coordenadas del modelo y del destino ajustado. [Pruebas de cámara](../src/geometry/camera.test.ts) · [Suite funcional](../tests/e2e/hito1.spec.ts) | CONFORME |
| Creación gráfica y numérica, longitud, orientación y previsualización | Nudo gráfico ajustado, nudos numéricos y barra polar N1–N2 de 2 m a 0° comprobados manualmente. Inspección del extremo provisional SVG y Vitest para la cancelación de barra. [Capa SVG](../src/modeler/canvas/StructureLayer.tsx) · [Pruebas del editor](../src/modeler/tools/editor.test.ts) | CONFORME |
| Coordenadas globales, UCS, relativas, polares y locales de barra | Vitest comprueba las transformaciones. Playwright verifica la entrada exacta con Snap activo y el movimiento relativo bajo un UCS rotado. [Pruebas de coordenadas](../src/geometry/coordinates.test.ts) · [Suite funcional](../tests/e2e/hito1.spec.ts) | CONFORME |
| Grid Snap, F9, preajustes e incrementos X/Y | Playwright verifica teclado, ajustes, entrada exacta y distinción de cuadrícula visual. Manualmente, con pasos 0,25 × 0,50 m, un clic generó N3 en X 1,25 m e Y 0,50 m. [Snap](../src/app/SnapControls.tsx) | CONFORME |
| Object Snap, F3 y referencias independientes | Vitest y Playwright verifican extremo, punto medio, intersección, tolerancia configurable, prioridad, caída a Grid o libre y conservación de filtros. El maestro §7.2 pide una etiqueta con el tipo de referencia. Hasta 1000 px esa etiqueta queda en el tooltip del estado y el lienzo conserva el marcador. [Resolvedor](../src/modeler/tools/snap.ts) · [Barra de estado](../src/app/StatusBar.tsx) · [Estilos](../src/styles.css) | PARCIALMENTE CONFORME |
| UCS compartido, indicador de orientación, origen gráfico y restauración | Playwright verifica ambos accesos y la invariancia de coordenadas. En la auditoría se eligió el origen sobre un nudo y se restauró Global. La regularización corrigió los dígitos residuales del formulario y conserva el ángulo en radianes al cambiar solo el origen. [Formulario UCS](../src/app/UcsForm.tsx) | CONFORME |
| Selección individual y múltiple, ventanas, resaltado, Esc y borrado | Playwright verifica clic, Ctrl, Mayús aditivo, ambas direcciones de ventana y eliminación mixta. La tolerancia en píxeles CSS se prueba a varias escalas. [Selección](../src/modeler/canvas/selection.ts) · [Pruebas](../src/modeler/canvas/selection.test.ts) | CONFORME |
| Movimiento individual y conjunto sin alterar conectividad | La referencia única determina el desplazamiento. Playwright y Vitest verifican Snap, selección mixta, el tratamiento de nudos ajenos al grupo y la conservación de IDs y extremos. Se revisó también en un modelo manual. [Dominio](../src/domain/structure.ts) · [Pruebas del editor](../src/modeler/tools/editor.test.ts) | CONFORME |
| Rechazo atómico y cruces geométricos sin conexión | Vitest cubre barras degeneradas, duplicadas, cruces y nudos fuera de rango. Playwright verifica el rechazo del movimiento que dejaría B2 sin longitud. [Pruebas de dominio](../src/domain/structure.test.ts) · [Suite funcional](../tests/e2e/hito1.spec.ts) | CONFORME |
| Nudos superpuestos e IDs independientes | Vitest verifica el límite de 10⁻⁸ m. Playwright y la revisión manual verifican aviso, identificación individual y desaparición al separar los nudos. [Detección](../src/domain/nodeOverlaps.ts) · [Pruebas](../src/domain/nodeOverlaps.test.ts) | CONFORME |
| Inspector compacto y propiedades de selección simple y múltiple | Resumen, recuentos, etiqueta común, avisos y valores distintos funcionan. Los grupos homogéneos incluyen propiedades claramente marcadas de solo lectura, tal como se validó en el cierre técnico previo. El maestro §3.2 pide limitar el panel múltiple a las propiedades comunes editables. [Inspector](../src/modeler/inspector/Inspector.tsx) · [Selección múltiple](../src/modeler/inspector/MultiSelection.tsx) | PARCIALMENTE CONFORME |
| Barra inferior y menús funcionales con teclado y ratón | Se comprobaron los accesos de Snap y UCS, el control separado de cuadrícula y el cierre por Esc y clic fuera sin accionar el modelo. [Barra](../src/app/StatusBar.tsx) · [Diálogos](../src/app/WorkspaceDialog.tsx) | CONFORME |
| Modal de atajos, foco y conservación del comando | Playwright verifica categorías, Enter, Tab, Esc y retorno del foco. La revisión manual confirmó el traslado después de cerrar la ayuda. [Modal](../src/app/WorkspaceDialog.tsx) | CONFORME |
| Disposición adaptable y límites visibles | Playwright a 1920 × 1080 y a 320, 480 y 800 px de ancho. Revisión manual a 419 px con Snap expandido. [Estilos](../src/styles.css) | CONFORME |
| Documentación coherente con la reorganización | La tabla de módulos y el apartado de controles sitúan Snap en la barra inferior y el UCS compartido en la barra y el indicador del lienzo. El inspector conserva la entrada numérica de modelado. [README](../README.md) · [Arquitectura](ARCHITECTURE.md) | CONFORME |
| Hoja de ruta y referencias aprobadas, requisito anteriormente parcial | Se cotejaron el maestro §§5.1–5.3, la adenda §§1–11 y la asignación de la regularización. Undo/Redo y edición estructural corresponden a Hito 2. Intercambio, persistencia y publicación corresponden a Hito 3. [Matriz anterior](HITO_1_ACCEPTANCE.md#matriz-de-conformidad) · [Hoja de ruta](DEVELOPMENT_ROADMAP.md) | CONFORME |
| Cotejo con el documento maestro y la adenda | Se archivaron y cotejaron ambas fuentes. La matriz registra las diferencias de presentación y la sección 9 separa los requisitos posteriores. | CONFORME |

### Trazabilidad del alcance

| Fuente | Aplicación en el Hito 1 y destino de los demás requisitos |
| --- | --- |
| Maestro §§3.1–3.2 y §5.1 | Lienzo, interacción CAD básica e inspector. La observación del inspector múltiple queda registrada en la matriz. |
| Maestro §§4.1, 4.3–4.4, 6.1, 6.3–6.4 y §9 | Modelado local, tecnologías y separación por responsabilidades, conectividad explícita, coordenadas y convenciones. El reductor cumple la responsabilidad de aplicación dentro de modeler/tools y la infraestructura de proyecto se incorpora con el Hito 3. Se verificaron m, radianes y convenciones geométricas. N y N·m aplicarán al incorporar fuerzas y momentos. |
| Maestro §§7–8 y §§11–12 | Snap físico y visual, selección, movimiento, eliminación, pruebas y revisión del estado real. |
| Maestro §5.2, §§6.2 y 6.5 y Adenda §1 | Hito 2. Apoyos, cargas, clic derecho contextual, Undo/Redo y edición avanzada. La regla de distancia física de cargas se mantiene como requisito al incorporar cargas. |
| Maestro §5.3 y Adenda §10 | Hito 3. Autoguardado, persistencia, validación, intercambio JSON y publicación. En el Hito 1 se prepara la base estática de Vite. La publicación y los ejemplos de la entrega pública corresponden al Hito 3. |
| Maestro §§2 y 3.3–3.5 y Adenda §§2–9 | Etapas posteriores. Diferenciación funcional de Aprender y Resolver, resultados, secciones, análisis, objetivos y explicación gráfica de ecuaciones. |
| Maestro §§4.1–4.2 y Adenda §11 | Servicios de nube y monetización quedan fuera del alcance inicial. La adenda exige conservar el desarrollo por hitos. |

## 4. Revisión funcional manual

Se usó un modelo de prueba creado en una sesión independiente del navegador integrado, sobre la compilación de producción.

1. Se introdujeron N1 y N2 con coordenadas exactas. El inspector mostró la barra polar B1 entre N1 y N2, longitud 2 m y ángulo 0°.
2. Se ajustó la vista, se seleccionaron dos nudos con clic y Mayús y se abrió la ayuda durante Mover. Esc cerró la ayuda y permitió confirmar el destino pendiente. El inspector mostró dos nudos seleccionados y una barra en el modelo, con Y común de −0,50 m.
3. Se configuró el UCS a 30° desde la barra y se eligió su origen sobre N1 desde el indicador. El formulario abierto después desde la barra mostró un origen global de X 0 m e Y −0,50 m. Se restauró Global.
4. En Snap se desactivó Extremo, se conservaron Punto medio e Intersección y se fijaron pasos de 0,25 y 0,50 m. La barra inferior y el inspector coincidieron al crear N3 en el punto ajustado.
5. Al superponer N3 sobre N1, el inspector mostró ambos IDs. Se eligió N3 desde el aviso y se separó. El aviso desapareció y el modelo conservó tres nudos y una barra.

## 5. Resultados de pruebas

| Comprobación | Ejecución | Resultado |
| --- | --- | --- |
| Vitest 4.1.12 | Suite existente con Node.js 24.22.1 | **47 aprobadas** en 7 archivos, salida 0. |
| Playwright 1.65.1 | npm run test:e2e con Edge para Windows | **14 aprobadas**, salida 0. |
| TypeScript 5.9.3 | tsc --noEmit | Sin errores, salida 0. |
| Compilación de producción | vite build mediante el script funcional | HTML, CSS y JavaScript generados en dist/. |
| Revisión manual | Navegador integrado sobre la compilación local | Flujo CAD completado y detalle de presentación UCS reproducido. |
| Regresión del ángulo UCS | Comprobación puntual en Edge sobre la nueva compilación | Al reabrir el formulario, 30° se muestra como 30. Cambiar solo el origen conservó la rotación SVG de un ángulo de alta precisión. |

## 6. Observaciones técnicas y visuales

- El lienzo ocupa la mayor superficie en escritorio. En la vista estrecha, el inspector se sitúa debajo del lienzo y es accesible mediante desplazamiento vertical. Los accesos compactos conservan su nombre accesible.
- Los diálogos nativos aíslan las interacciones del lienzo mientras están abiertos. Esc o clic fuera cierran el panel, que devuelve el foco al botón de origen. [Diálogos](../src/app/WorkspaceDialog.tsx)
- La apertura visual de Object Snap es independiente de la tolerancia de selección y de la tolerancia física de coincidencia. La entrada numérica se aplica directamente en el editor. [Snap](../src/modeler/tools/snap.ts) · [Superposición](../src/domain/nodeOverlaps.ts)

## 7. Observaciones resueltas y pendientes

- **Resuelta · Fuentes y hoja de ruta.** El requisito «Hoja de ruta y referencias aprobadas», antes **PARCIALMENTE CONFORME**, pasa a **CONFORME**. El cotejo, antes **NO VERIFICABLE**, se completó con las dos fuentes archivadas. [Hoja de ruta](DEVELOPMENT_ROADMAP.md)
- **Resuelta · Presentación UCS.** Se redondea la representación editable a 15 cifras significativas al abrir el formulario. Si se confirma el ángulo mostrado sin modificarlo, incluso al cambiar solo el origen, se conserva el valor original en radianes. Un ángulo nuevo se convierte desde todo el valor numérico escrito. [Formulario UCS](../src/app/UcsForm.tsx)
- **Resuelta · Documentación de la interfaz.** La tabla de módulos identifica la barra inferior y el indicador del lienzo como accesos a Snap y UCS. También se dejó explícito el carácter preliminar de Aprender/Resolver. [Arquitectura](ARCHITECTURE.md) · [Hoja de ruta](DEVELOPMENT_ROADMAP.md)
- **Pendiente no bloqueante · Inspector múltiple.** El maestro §3.2 pide mostrar únicamente propiedades comunes editables. En selecciones homogéneas, el inspector también muestra propiedades comunes de solo lectura, identificadas como tales y con aviso de valores distintos. La etiqueta común sigue siendo la única edición conjunta. [Inspector múltiple](../src/modeler/inspector/MultiSelection.tsx)
- **Pendiente no bloqueante · Etiqueta Object Snap en anchuras reducidas.** El maestro §7.2 pide identificar el tipo con una etiqueta. Hasta 1000 px el nombre queda en el tooltip del estado. El marcador, las coordenadas ajustadas y el ajuste geométrico siguen activos. [Barra inferior](../src/app/StatusBar.tsx) · [Estilos](../src/styles.css)

Las dos observaciones pendientes afectan la presentación. Los escenarios ejecutados conservaron los valores, el ajuste y las operaciones del modelo. En la regularización el único cambio de código fue el formato del formulario UCS. Se ejecutaron las suites existentes sin modificarlas.

## 8. Riesgos de arquitectura

| Riesgo | Evidencia y alcance |
| --- | --- |
| Rendimiento en modelos grandes | Object Snap compara pares de barras para calcular intersecciones y recorre candidatos al mover el puntero. La detección de superposiciones puede hacer comparaciones cuadráticas en distribuciones densas. La corrida no incluyó mediciones de escala. [Snap](../src/modeler/tools/snap.ts) · [Superposición](../src/domain/nodeOverlaps.ts) |
| Precisión en magnitudes extremas | El rango llega a ±10⁹ m y las tolerancias físicas son del orden de 10⁻⁸ m. La resolución de punto flotante disminuye con la magnitud. La cobertura comprende casos representativos y el límite de tolerancia, sin un barrido del intervalo completo. [Geometría](../src/geometry/coordinates.ts) |
| Entorno y trazabilidad | La terminal resuelve Node.js 20.18.0 por defecto y la auditoría se ejecutó con 24.22.1. El directorio carece de Git y depende de respaldos para reconstruir versiones. [README](../README.md) |
| Cobertura de navegadores | La corrida automatizada cubre Edge para Windows y la manual el navegador integrado. El ancho mínimo implementado es 320 px. [Configuración Playwright](../playwright.config.ts) |

## 9. Requisitos reservados para hitos posteriores

- **Hito 2.** Apoyos, cargas, menús contextuales, edición avanzada y Undo/Redo.
- **Hito 3.** Persistencia en IndexedDB, intercambio de proyectos y publicación. La preparación de la compilación estática pertenece al Hito 1.
- **Etapas posteriores.** Métodos de análisis, resultados independientes, editor de secciones, materiales, objetivos de análisis, explicación gráfica de ecuaciones y experiencias diferenciadas de Aprender y Resolver. Nearest, Perpendicular, unión explícita en intersecciones y servicios de nube quedan fuera del Hito 1. [Hoja de ruta](DEVELOPMENT_ROADMAP.md)

## 10. Dictamen técnico final

**APTO PARA CIERRE CON OBSERVACIONES NO BLOQUEANTES.** El cotejo de las dos fuentes oficiales levantó el bloqueo anterior. Se comprobó el funcionamiento del alcance del Hito 1 y se registraron las diferencias de presentación del inspector múltiple y de la etiqueta de Object Snap. El dictamen técnico no equivale al inicio del Hito 2.
