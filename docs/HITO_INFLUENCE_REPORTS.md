# Líneas de influencia múltiples y reportes

En **Resultados → Líneas de influencia**, configura el recorrido y la dirección. Selecciona un objetivo y usa **Agregar a líneas mostradas**. Repite para las consultas que quieras comparar y ejecuta **Analizar estructura**. El Worker evalúa hasta ocho consultas sobre el mismo recorrido, dirección y tren opcional. Reutiliza soluciones de estaciones compartidas. Las curvas y límites se obtienen del método de influencia existente. El oráculo Gerber comprueba las reacciones en S = 6 y 8 m mediante equilibrio independiente.

Cada línea conserva su objetivo, entidad, estación, lado, nombre, color, escala, orden y visibilidad. Las franjas comparten la abscisa S y la posición móvil. Su escala vertical es independiente. La posición, apariencia y selección de franjas no cambian la estructura ni el historial. Una edición física o de los datos de cálculo oculta los resultados hasta recalcular.

**Exportar reporte de líneas de influencia** admite PDF vectorial, SVG y PNG. Selecciona A4 o A3 y orientación. Puedes elegir líneas visibles o un conjunto específico. El orden, color y escala se toman de las líneas configuradas. La vista previa y los archivos comparten el mismo SVG. El encabezado, los apoyos, las cotas y el eje longitudinal se repiten en cada página. El PNG y el SVG apilan las páginas completas en un archivo, y el PDF conserva páginas separadas. El reporte de un recorrido inclinado o quebrado usa la proyección desarrollada S rotulada. El CAD conserva su geometría real.

| Verificación | Evidencia |
| --- | --- |
| Cinco líneas, sincronización en S, salto, visibilidad, orden y color | Playwright inspecciona las franjas y sus ordenadas. |
| Reporte multipágina | Playwright verifica el total de bandas, apoyos y la proyección coincidente entre páginas. |
| Exportación | Playwright comprueba las tres descargas. El SVG conserva los saltos y anotaciones, y el PDF se renderiza con Poppler para verificar sus dos páginas. |
| Vigencia y Undo/Redo | Playwright comprueba que desaparece el reporte al editar el recorrido y que las opciones no introducen operaciones en el historial. |

[Líneas múltiples](media/lineas-influencia-multiples.png) · [Vista previa](media/influencia-vista-previa.png) · [PDF](media/reporte-influencia-ejemplo.pdf) · [SVG](media/reporte-influencia-ejemplo.svg) · [PNG](media/reporte-influencia-ejemplo.png)

## Aceptación de la entrega local

| Área | Estado y comprobación |
| --- | --- |
| Liberaciones y conectividad | Conforme para pórticos 2D. Ensayos independientes de Gerber, semivigas empotradas, pórtico unilateral, viga biarticulada y mecanismo. |
| Métodos | Conforme dentro del alcance documentado. Se contrastaron rigideces, trabajo virtual traslacional, fuerzas, Cross sin giro apreciable de cuerda e influencia Gerber. El giro liberado por trabajo virtual de cara devuelve un diagnóstico. |
| AVM y deformada | Conforme en los casos ensayados. Desarrollo colineal, disposición compacta, lados del corte y selección por ID, con adaptación a móvil. |
| Formato y legibilidad | Conforme en los casos ensayados. Las vistas resumidas aplican el formato visual y Aprender mantiene más cifras en las tablas de comprobación. La colocación automática en CAD usa el espacio disponible y puede ocultar etiquetas secundarias. |
| Reportes y vigencia | Conforme en los casos ensayados. Descargas PDF, SVG y PNG y comprobación visual de las dos páginas PDF. Hasta ocho consultas simultáneas por recorrido. |
| Persistencia | Conforme en los casos ensayados. JSON v1–v5 migra a v6, las liberaciones forman parte de la revisión física y se valida la ida y vuelta. |

La línea base arrojó 263 pruebas Vitest, 70 Playwright en Edge, TypeScript y compilación. La regresión de la entrega obtuvo 273 pruebas Vitest, 73 Playwright en Edge, 73 en Chromium y 28 representativas en Firefox. Después del ajuste final de etiquetas se repitieron las 12 pruebas de AVM y líneas de influencia en cada navegador. TypeScript y la compilación de producción pasaron. Vite avisó que el paquete principal supera ligeramente 500 kB minificados.

El respaldo local parte del commit verificado del Hito 8.2. La entrega se conserva en la rama local `codex/rotulas-avm-influencia`.
