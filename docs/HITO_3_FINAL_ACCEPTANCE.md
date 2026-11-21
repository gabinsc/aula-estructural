# Hito 3 · Persistencia local y preparación de publicación

**Dictamen · APTO CON OBSERVACIONES.** Los flujos de almacenamiento, recuperación y JSON pasaron sobre la compilación estática local. La ejecución remota de GitHub Pages queda pendiente de la autorización de publicación.

## Arquitectura y versiones

El gestor del espacio de trabajo recupera el último proyecto de IndexedDB al arrancar. El adaptador separado de React usa la base `aula-estructural-projects` versión 1 con almacenes de proyectos y preferencias. Los datos de un proyecto se registran con su ID y una revisión para detectar cambios de otras pestañas. La versión de la base y la versión del documento se mantienen separadas. El documento usa el esquema 1 y rechaza explícitamente versiones desconocidas. Una versión futura requerirá su propia migración.

| Campo de esquema 1 | Función |
| --- | --- |
| `id`, `name` | Identidad de proyecto independiente de los IDs de nudos, barras y cargas. |
| `createdAt`, `modifiedAt` | Fechas ISO de creación y modificación. |
| `model` | Nudos, barras, apoyos, cargas, conectividad y contadores del documento. |
| `view` | Cuadrícula visual y modo de cotas. |

El validador exige tipos y números finitos, IDs únicos y contadores válidos, referencias entre entidades, longitud de barra válida e incompatibilidad de duplicados por par de extremos, orientación normalizada del rodillo, y magnitudes, marcos, perfiles e intervalos admitidos. Un proyecto se abre o importa después de pasar la validación del documento completo. [Esquema y validador](../src/projects/document.ts) · [Repositorio IndexedDB](../src/infrastructure/projectStore.ts)

## Guardado y gestión

- El autoguardado observa cambios confirmados de modelo o de preferencias persistentes. Espera 450 ms para agrupar cambios y serializa las escrituras. La selección, el puntero, la cámara, UCS, Snap y vistas previas son estado temporal. El guardado no entra al historial.
- Cada sesión lleva el ID y la revisión del documento abierto. Al intentar cambiar de proyecto se espera el guardado de la versión actual. Si falla, se informa y se solicita consentimiento para salir. Un conflicto conserva los cambios en memoria y permite exportarlos o guardarlos como copia.
- El indicador muestra cambios pendientes, escritura, guardado confirmado o error. Se vigila el cierre con cambios pendientes o escrituras en curso mediante el aviso del navegador. El navegador decide cuándo presentar ese aviso.
- **Proyectos** permite crear, guardar, abrir, renombrar, duplicar, eliminar con confirmación, listar por fecha y exportar JSON. El gestor restablece el historial al abrir un documento. Importar crea un nuevo ID de proyecto y conserva datos e IDs estructurales. Los dos ejemplos públicos contienen datos sintéticos. [Menú](../src/app/ProjectMenu.tsx) · [Autoguardado](../src/projects/useProjectSave.ts) · [Pórtico](../examples/portico.json) · [Modelo vacío](../examples/vacio.json)

## Preparación estática

La aplicación se compiló con base `/aula-estructural/`. Playwright cargó, usó y recargó el editor en esa subruta con Vite Preview sirviendo solo los archivos compilados. La aplicación no requiere un servidor de aplicación. IndexedDB está separado por origen y perfil, por lo que los proyectos de desarrollo se transfieren a otro origen mediante JSON.

Se preparó el flujo de Pages con activación manual, instalación desde el lockfile, Vitest, tipos, compilación y artefacto `dist/`. El repositorio local tiene el commit de referencia `f676688` y exclusiones para dependencias, salidas y datos locales. No se creó un remoto ni se ejecutó el flujo en GitHub. [Configuración Vite](../vite.config.ts) · [Flujo manual](../.github/workflows/pages.yml) · [Guía oficial de Vite](https://vite.dev/guide/static-deploy.html#github-pages) · [Configuración de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Matriz de aceptación

| Requisito | Evidencia | Estado |
| --- | --- | --- |
| Crear, guardar, abrir y recuperar el último proyecto | Playwright crea, renombra, recarga y recupera el proyecto activo. | Conforme |
| Listar y gestionar varios proyectos | Playwright verifica copia, reapertura, confirmación y cancelación de eliminación. | Conforme |
| Modelo vacío y documento completo | Vitest valida ambos ejemplos. Playwright conserva un documento vacío y otro con cargas y apoyo. | Conforme |
| Identidad y equivalencia física | Playwright compara el modelo completo antes y después de recargar e importar. Comprueba IDs, referencias, rodillo, fuerzas y distancias físicas. | Conforme |
| Autoguardado, borradores y transacciones | Playwright espera la escritura tras modificar geometría y confirma que un borrador de carga desaparece al recargar y que Undo inicia vacío. | Conforme |
| Gestión de fallos de IndexedDB | Playwright deshabilita IndexedDB, comprueba el aviso y exporta los datos que siguen en memoria. | Conforme |
| Concurrencia y separación por ID | Playwright intenta escribir desde una pestaña atrasada. Se rechaza el guardado, se puede exportar y la revisión válida permanece recuperable. | Conforme |
| JSON válido y rechazo de archivos incompatibles | Vitest rechaza versiones, números, referencias, duplicados, contadores y distancias inválidas. Playwright rechaza JSON corrupto y conserva el proyecto activo. | Conforme |
| Sitio estático y preparación de GitHub Pages | Compilación y recarga en la subruta de publicación bajo Vite Preview. Flujo de ejecución manual disponible. | Conforme localmente |
| Ejecución remota y sitio publicado | Requiere un repositorio autorizado y una ejecución manual. | No verificado |

## Verificación final

| Comprobación | Resultado |
| --- | --- |
| Vitest | **94 aprobadas** en 14 archivos. |
| Playwright | **35 aprobadas** en Edge para Windows sobre la compilación estática, incluidas cuatro pruebas de proyectos. |
| TypeScript | `tsc --noEmit` finalizó sin errores. |
| Producción | `vite build` finalizó correctamente. |

Node.js 24.22.1. La prueba integral comparó el JSON exportado antes y después de recargar, y tras importarlo como un proyecto distinto. La geometría, los IDs, las referencias, las restricciones, los vectores y los intervalos coincidieron. Los escenarios integrados de dominio y navegador mantuvieron las comprobaciones del Hito 2. [Pruebas de documento](../src/projects/document.test.ts) · [Pruebas de proyectos](../tests/e2e/projects.spec.ts) · [Aceptación del Hito 2](HITO_2_FINAL_ACCEPTANCE.md)

## Límites y riesgos

- IndexedDB depende del perfil, origen, cuota y políticas de almacenamiento del navegador. Exportar JSON es el medio para trasladar una copia fuera del navegador.
- El control de revisiones detecta conflictos. La combinación de ediciones concurrentes queda fuera de alcance.
- Las pruebas de navegador se realizaron en Edge para Windows. El flujo de Actions se preparó con documentación oficial y queda pendiente de una ejecución remota autorizada.
- Se mantiene fuera del alcance el motor de análisis y cualquier servicio remoto.
