# Hito 2.2 · Apoyos estructurales 2D

## Alcance y recuperación

El modelador permite asignar, consultar, modificar y quitar apoyos articulados, de rodillo y empotrados. La herramienta **Apoyo (A)** selecciona un nudo existente. El Inspector muestra su ID, tipo, orientación y grados de libertad restringidos y permitidos. El tipo y el ángulo se confirman antes de modificar el modelo.

Se revisaron el dominio, el historial 2.1, la selección geométrica, el lienzo, el Inspector y las referencias oficiales. El borrador recuperado de 2.1 proponía un tipo discriminado y la normal global del rodillo. La implementación conserva esas ideas y exige identificar el apoyo vigente antes de reemplazarlo. El respaldo previo a la intervención contiene 55 archivos cotejados por SHA-256. [Respaldo local](../.qa.local/respaldo-antes-hito-2.2-20261121-112603.zip) · [Documento maestro, §6.5](requisitos/DOCUMENTO_MAESTRO_2026-11-21.md) · [Adenda](requisitos/ADENDA_REQUISITOS_2026-11-21.md)

## Decisiones e invariantes

- El ID estable del nudo sirve como clave de su apoyo. La operación de dominio comprueba que el nudo exista y que el apoyo actual sea el esperado. Una segunda asignación sin identificar el apoyo anterior se rechaza.
- La inclinación del rodillo se guarda en radianes y se introduce en grados. Se mide desde +X global en sentido antihorario. La restricción coincide con la normal `(−sin θ, cos θ)`. El giro en SVG usa el signo contrario por la inversión del eje Y. Se conserva el lado dibujado de la superficie dentro de una vuelta completa.
- El símbolo se ancla al nudo proyectado y mantiene sus dimensiones en píxeles CSS. El rodillo muestra la superficie y su normal. Los símbolos dejan pasar los eventos de puntero y no participan en la selección geométrica.
- Cada asignación, cambio de tipo, giro o eliminación confirmada produce una versión del modelo. El borrado de un nudo incluye su apoyo y sus barras incidentes en una sola transacción. El reductor de historial de 2.1 se reutiliza sin cambios.
- El movimiento conserva IDs, barras y apoyos. Las coincidencias geométricas entre nudos no cambian las referencias de las barras. Cada apoyo se consulta por su propio ID de nudo.

## Verificación

| Verificación | Resultado |
| --- | --- |
| Vitest | **59 aprobadas** en 9 archivos. Se cubrieron grados de libertad, ortogonalidad de la normal, ángulos inválidos, nudos inexistentes, duplicados, reemplazos, borrados, movimiento y deshacer/rehacer. |
| Playwright | **19 aprobadas** en Edge para Windows. Los dos escenarios nuevos verificaron asignación y edición, geometría SVG del rodillo, tamaño al cambiar zoom, independencia del UCS, superposiciones, borrado y recuperación de la conectividad. |
| TypeScript | `tsc --noEmit` terminó correctamente. |
| Producción | `vite build` terminó correctamente. Playwright utilizó la compilación de producción bajo la subruta del proyecto. |

Las verificaciones se ejecutaron con Node.js 24.22.1. Las pruebas de los Hitos 1 y 2.1 se conservaron y pasaron.

## Archivos modificados

- **Dominio y editor.** [support.ts](../src/domain/support.ts), [structure.ts](../src/domain/structure.ts) y [editor.ts](../src/modeler/tools/editor.ts).
- **Herramientas, lienzo e Inspector.** [Tools.tsx](../src/app/Tools.tsx), [Icon.tsx](../src/app/Icon.tsx), [WorkspaceDialog.tsx](../src/app/WorkspaceDialog.tsx), [ModelCanvas.tsx](../src/modeler/canvas/ModelCanvas.tsx), [StructureLayer.tsx](../src/modeler/canvas/StructureLayer.tsx), [SupportSymbol.tsx](../src/modeler/canvas/SupportSymbol.tsx), [Inspector.tsx](../src/modeler/inspector/Inspector.tsx), [NodeSupport.tsx](../src/modeler/inspector/NodeSupport.tsx) y [styles.css](../src/styles.css).
- **Pruebas.** [support.test.ts](../src/domain/support.test.ts), [history.test.ts](../src/modeler/tools/history.test.ts) y [suite Playwright](../tests/e2e/hito1.spec.ts).
- **Documentación.** [README](../README.md), [modelo de datos](DATA_MODEL.md), [arquitectura](ARCHITECTURE.md), [hoja de ruta](DEVELOPMENT_ROADMAP.md) y este informe.

## Limitaciones y decisiones pendientes

- Dos apoyos en la misma posición pueden solaparse visualmente. El aviso existente permite identificar cada nudo y consultar su apoyo en el Inspector de forma independiente.
- Los tres tipos representan restricciones cinemáticas ideales. Las restricciones personalizadas y la interpretación de estas restricciones en el cálculo quedan para etapas posteriores.
- El documento y el historial viven en memoria durante la sesión. El formato persistente y su validación corresponden al Hito 3. Las cargas, reacciones, análisis y menús contextuales quedan fuera de esta entrega.
