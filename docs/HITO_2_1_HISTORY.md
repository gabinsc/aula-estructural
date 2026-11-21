# Hito 2.1 · Historial de operaciones

## Línea base y recuperación

La revisión encontró un historial centralizado, los atajos y sus pruebas iniciales. La línea base pasó 51 pruebas Vitest y la comprobación de tipos. También había un borrador incompleto de apoyos, retirado del código activo porque corresponde a un incremento posterior.

El respaldo local `.qa.local/respaldo-previo-revision-2.1-20261121-111540.zip` conserva los 55 archivos fuente, de configuración, documentación y pruebas anteriores a la intervención. Se cotejó el SHA-256 de cada entrada contra el original. Se puede recuperar el estado extrayendo el ZIP en una carpeta aparte. El directorio carece de repositorio Git. Se propone inicializar un repositorio local sobre el código existente, sin publicación remota.

## Diseño y comportamiento

El reductor de historial existente guarda hasta 100 versiones inmutables de `Structure` y comparte las entidades que no cambian entre versiones. La referencia del modelo permite distinguir una edición confirmada de un error, una previsualización o un ajuste de la vista. Esta estrategia reutiliza las validaciones del dominio y recupera los identificadores y conexiones de cada versión sin programar inversas para cada herramienta.

| Operación | Unidad registrada |
| --- | --- |
| Crear un nudo | Nudo confirmado mediante clic o coordenadas. Usar un nudo existente conserva el historial. |
| Crear una barra | Barra y extremos que deban crearse al confirmar el segundo extremo. |
| Eliminar | Selección completa y barras incidentes a los nudos eliminados. |
| Mover o modificar coordenadas | Un destino confirmado para un nudo o para todos los nudos seleccionados. La previsualización es transitoria. |
| Cambiar la etiqueta común | Una modificación para toda la selección. Las propiedades geométricas calculadas se derivan del modelo. |

Deshacer y rehacer vuelven a la herramienta Seleccionar, conservan las selecciones que siguen siendo válidas y recalculan las coincidencias geométricas. Una edición nueva confirmada invalida la rama de rehacer. Zoom, pan, UCS y Snap conservan su estado actual. El historial dura lo que dure la sesión en memoria.

Los botones compactos están en la barra superior y se deshabilitan según la disponibilidad de cada acción. La ayuda de atajos recoge Ctrl/Cmd + Z, Ctrl + Y y Ctrl/Cmd + Mayús + Z. Durante la edición de texto se conserva el comportamiento nativo del campo.

## Verificación

| Verificación | Resultado |
| --- | --- |
| Vitest | 53 aprobadas en 8 archivos. Incluye transacciones, IDs, conectividad, invalidación de Redo, operaciones rechazadas y borrados sin efecto. |
| Playwright | 17 aprobadas en Edge para Windows. Incluye botones, atajos Ctrl y Meta, deshacer nativo en texto, restauración de borrado múltiple, movimiento conjunto con superposición y exclusión de zoom, pan y Snap. Las combinaciones Meta se probaron en Edge para Windows. |
| TypeScript | `tsc --noEmit` terminó correctamente. |
| Producción | `vite build` terminó correctamente y la suite de Playwright usó esa compilación. |

Se utilizó Node.js 24.22.1. El primer intento de Playwright bajo el sandbox se interrumpió tras fallar al iniciar la prueba de navegador. En Edge fuera del sandbox, la comprobación nueva de la barra superior localizaba el encabezado mediante un rol que el navegador no exponía para ese elemento anidado. Se corrigió el selector del escenario nuevo y la repetición completa pasó.

## Archivos

- [App](../src/app/App.tsx), [herramientas](../src/app/Tools.tsx) y [estilos](../src/styles.css) sitúan los controles del historial en la barra superior.
- [Dominio](../src/domain/structure.ts) conserva la referencia del modelo si el borrado no produce cambios. Ese archivo, el [editor](../src/modeler/tools/editor.ts), el [lienzo](../src/modeler/canvas/ModelCanvas.tsx), los [iconos](../src/app/Icon.tsx) y la [ayuda](../src/app/WorkspaceDialog.tsx) también dejan de integrar el borrador de apoyos. El archivo `src/domain/support.ts` queda en el respaldo.
- [Vitest](../src/modeler/tools/history.test.ts) y [Playwright](../tests/e2e/hito1.spec.ts) amplían la cobertura del historial.
- [README](../README.md), [arquitectura](ARCHITECTURE.md) y [hoja de ruta](DEVELOPMENT_ROADMAP.md) documentan la entrega.

## Pendientes

La auditoría del Hito 1 conserva dos observaciones no bloqueantes. El inspector múltiple incluye propiedades comunes de solo lectura y el nombre de la referencia Object Snap queda en el tooltip en anchuras de hasta 1000 px. [Auditoría del Hito 1](HITO_1_FINAL_AUDIT.md)

La implementación 2.1 queda para revisión. Apoyos, cargas, menús contextuales y edición avanzada corresponden a incrementos posteriores del Hito 2. La persistencia del proyecto corresponde al Hito 3.
