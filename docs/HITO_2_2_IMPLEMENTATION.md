# Hito 2.2 · Implementación de apoyos estructurales

## Resumen ejecutivo

El Hito 2.2 implementa apoyos articulados, de rodillo y empotrados en el modelador CAD. La revisión del código activo encontró los tres tipos integrados con el lienzo, el Inspector y el historial. Se corrigió el registro de orientaciones equivalentes en Undo/Redo y se verificó el alcance de nuevo. **Dictamen técnico · Apto para revisión.** La aceptación corresponde al responsable del proyecto.

## Línea base y arquitectura

La línea base fue Aula Estructural `0.1.0`, con el Hito 2.2 ya presente. El directorio seguía sin repositorio Git. Antes de editar se archivaron 60 archivos fuente, de configuración, pruebas y documentación. Se cotejó cada entrada contra el original mediante SHA-256. El SHA-256 del ZIP es `75DD2288C91A9CA6DE41016BF2F0D5E5BC37CE9E53BC7DA8D7477DAE6EDC7ED9`. El borrador anterior y su evaluación están registrados en la entrega inicial. [Respaldo de esta revisión](../.qa.local/respaldo-previo-aceptacion-2.2-20261121-113352.zip) · [Entrega inicial](HITO_2_2_SUPPORTS.md)

El dominio valida la operación y conserva las restricciones físicas. El editor publica la nueva versión de `Structure`, el Inspector mantiene el borrador hasta su confirmación y la capa SVG deriva los símbolos del documento. La cámara y el UCS siguen perteneciendo al espacio de trabajo. [Arquitectura](ARCHITECTURE.md)

## Modelo de datos y restricciones

Cada apoyo usa `nodeId` como identidad estable, `kind` como tipo y, para rodillos, `surfaceAngle` en radianes globales. Un nudo admite un apoyo. Para reemplazarlo se debe confirmar la edición sobre el apoyo vigente. Un nudo inexistente, un apoyo vigente distinto del esperado o un ángulo no finito se rechazan.

| Tipo | Restringe | Permite |
| --- | --- | --- |
| Articulado | Traslación X e Y globales | Rotación |
| Rodillo | Traslación normal a la superficie | Traslación tangencial y rotación |
| Empotrado | Traslación X e Y globales y rotación | Ningún grado de libertad |

Se conserva la convención aprobada de medir el **ángulo de la superficie** `θ` desde +X global en sentido antihorario. La normal unitaria es `n = (−sin θ, cos θ)`, equivalente a medir la dirección de la normal como `θ + π/2`. La ecuación de la restricción es `nₓuₓ + nᵧuᵧ = 0`. El dominio entrega las direcciones globales y la restricción de rotación para su futura interpretación en cálculo. [Modelo de datos](DATA_MODEL.md) · [Dominio](../src/domain/support.ts)

## Representación gráfica y editor

El símbolo se ancla a la proyección del nudo, conserva dimensiones en píxeles CSS y deja pasar los eventos de puntero. El articulado usa un triángulo con base, el rodillo incorpora ruedas y una flecha sobre la normal y el empotramiento usa una base rayada. El símbolo del rodillo gira con el signo inverso por la inversión de Y en pantalla. El UCS conserva el ángulo físico global. [Símbolo SVG](../src/modeler/canvas/SupportSymbol.tsx)

**Apoyo (A)** permite elegir un nudo existente. El Inspector presenta el tipo, la orientación y los grados de libertad. El formulario permite asignar, aplicar cambios o quitar el apoyo. El editor usa el mismo flujo de operaciones confirmado al crear, mover o borrar nudos. [Guía de uso](../README.md) · [Inspector](../src/modeler/inspector/NodeSupport.tsx) · [Editor](../src/modeler/tools/editor.ts)

## Undo/Redo y error corregido

La creación, el cambio de tipo, el giro y la eliminación de un apoyo se registran como transacciones individuales. Borrar un nudo incorpora su apoyo y sus barras incidentes en la misma transacción. El historial restaura los estados por referencia, con los IDs y conexiones originales. [Historial](../src/modeler/tools/history.ts)

La comparación exacta de dos inclinaciones normalizadas podía registrar una edición al cambiar −25° por 335° y descartar Redo. Una prueba nueva reprodujo el fallo antes de la corrección. El dominio compara ahora la diferencia angular circular con un margen de redondeo de una vuelta. En ese margen conserva el ángulo anterior, la referencia del modelo y ambas pilas. La misma prueba verifica que un ángulo inválido conserva Redo. [Prueba de regresión](../src/modeler/tools/history.test.ts)

## Matriz de cumplimiento

| Requisito | Estado | Evidencia |
| --- | --- | --- |
| Creación, asignación y consulta de los tres tipos | Conforme | Playwright asigna rodillo, articulado y empotrado. Vitest verifica sus grados de libertad. |
| Nudo válido, un apoyo por ID y reemplazo explícito | Conforme | Vitest rechaza referencias inexistentes y reemplazos sobre un apoyo distinto del esperado. Playwright comprueba que cambiar la opción del formulario conserva el apoyo hasta confirmar. |
| Rodillo inclinado, dirección normal y UCS | Conforme | Vitest comprueba la normal unitaria ortogonal. Playwright coteja la matriz SVG a 30° y verifica que el símbolo conserva su transformación al cambiar UCS. |
| SVG anclado, legible y compatible con la selección | Conforme | Playwright verifica tamaño al cambiar el zoom, paso de eventos de puntero y traslación del símbolo con su nudo. |
| Editar orientación, cambiar tipo y quitar el apoyo | Conforme | Playwright confirma cambios de giro y tipo y verifica que quitar un apoyo conserva el nudo y sus barras. |
| Movimiento, borrado y nudos superpuestos | Conforme | Vitest verifica el modelo al trasladar y borrar. Playwright lleva dos nudos con apoyos a la misma posición y consulta ambos por ID. |
| Undo/Redo de las nuevas operaciones | Conforme | Vitest recorre la secuencia completa de apoyo. Playwright recupera el apoyo y las conexiones de las barras tras borrar un nudo. |
| Historial inmune a operaciones inválidas o equivalentes | Conforme | Vitest verifica identidad del modelo y de ambas pilas para un ángulo no finito y dos ángulos equivalentes. |
| Snap, selección múltiple y regresiones 1 y 2.1 | Conforme | Pasaron los escenarios de Grid Snap, Object Snap, UCS, selección múltiple, movimiento y atajos de historial. |

Las pruebas citadas están en [Vitest de apoyos](../src/domain/support.test.ts), [Vitest de historial](../src/modeler/tools/history.test.ts) y [Playwright](../tests/e2e/hito1.spec.ts).

## Pruebas ejecutadas

| Verificación | Resultado |
| --- | --- |
| Vitest | 60 aprobadas en 9 archivos. La línea base pasó 59 y la prueba de regresión pasó tras la corrección. |
| Playwright | 19 aprobadas en Microsoft Edge para Windows sobre la compilación de producción. |
| TypeScript | `tsc --noEmit` finalizó correctamente. |
| Compilación | `vite build` finalizó correctamente. |

Entorno de verificación con Node.js 24.22.1. Las pruebas existentes se conservaron.

## Archivos

- Esta revisión modificó [support.ts](../src/domain/support.ts), [history.test.ts](../src/modeler/tools/history.test.ts), [README](../README.md), [modelo de datos](DATA_MODEL.md) y [hoja de ruta](DEVELOPMENT_ROADMAP.md). Se creó este informe y el respaldo local descrito arriba.
- El inventario de los archivos creados y modificados en la implementación inicial está en el [informe de entrega](HITO_2_2_SUPPORTS.md#archivos-modificados).

## Limitaciones, riesgos y siguiente incremento

Dos apoyos coincidentes pueden solaparse en el lienzo. El Inspector permite distinguirlos por ID mediante el aviso de nudos superpuestos. La verificación de navegador se realizó en Edge para Windows. El documento y el historial se mantienen en memoria durante la sesión.

Para el siguiente incremento, conviene reutilizar las validaciones de referencias por ID y registrar las operaciones que afecten a varias entidades como una sola transacción. Cuando se incorpore el cálculo estructural, se recomienda probar el ensamblaje con un caso de rodillo oblicuo que compruebe `nₓuₓ + nᵧuᵧ = 0`. Esta entrega concluye en el Hito 2.2.
