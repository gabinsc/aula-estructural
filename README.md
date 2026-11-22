# Aula Estructural

Modelador CAD 2D para dibujar y estudiar estructuras planas. Permite editar nudos y barras, aplicar apoyos y cargas, analizar armaduras y pórticos, y guardar proyectos en el navegador.

Para empezar, abre **Proyectos → Ejemplos**, elige un ejercicio y pulsa **Abrir copia editable**. La ficha explica qué observar y ofrece resultados de referencia. **Proyectos → Guía rápida** contiene los pasos para crear un modelo desde cero. [Guía de usuario](docs/USER_GUIDE.md) · [Preparación del Hito 6 para Pages](docs/HITO_6_BETA_RELEASE.md)

## Ejecutar en local

Requiere Node.js 22.12 o posterior de la serie 22, o Node.js 24 o posterior, y npm 11. La instalación se verificó con Node.js 24 y npm 11. Comprueba las versiones desde la terminal en la que ejecutarás el proyecto.

```sh
node --version
npm --version
npm ci
npm run dev
```

Abre la dirección local que muestra Vite, normalmente `http://localhost:5173/aula-estructural/`.

Si en Windows aparece «Cannot find native binding» después de instalar con Node.js 20.18, cambia a Node.js 24 y npm 11 y ejecuta `npm ci` de nuevo para reinstalar las dependencias desde el archivo de bloqueo, incluido el binario nativo de Rolldown.

## Dibujar y consultar

1. Activa **Nudo (N)** y pulsa en el plano o introduce X e Y en el inspector.
2. Activa **Barra (B)** y fija el extremo inicial. Para el extremo final puedes pulsar en el lienzo, introducir coordenadas globales o UCS, indicar un desplazamiento relativo o usar distancia y ángulo.
3. Usa **Seleccionar (V)** para consultar propiedades. El clic simple selecciona un objeto. **Ctrl** o **Cmd** + clic alterna el objeto y **Mayús** + clic lo añade o lo conserva. Arrastra de izquierda a derecha para seleccionar elementos totalmente contenidos, o de derecha a izquierda para incluir las barras que intersectan el recuadro. Mantén un modificador para sumar el recuadro. **Supr** elimina la selección y las barras incidentes a los nudos eliminados.
4. Selecciona los nudos que quieres trasladar y activa **Mover (M)**. Con varios nudos puedes elegir la referencia en el inspector. Su destino, indicado en el lienzo o por entrada numérica, determina el desplazamiento común. Las barras seleccionadas por sí solas no incorporan sus extremos al movimiento. Si una barra queda con longitud inválida, se rechaza el desplazamiento completo.
5. El indicador **UCS** de la esquina inferior izquierda del lienzo muestra el sistema activo y su orientación. Desde ese indicador o desde **UCS** en la barra inferior puedes configurar el origen y la rotación, elegir el origen en el lienzo o restablecer el sistema global. Las entradas relativas y polares usan la orientación del UCS desde el nudo de referencia.
6. Usa la rueda para acercar o alejar bajo el cursor. Arrastra con el botón central, con **Espacio** o con **Desplazar (H)**. **F** ajusta la vista. **Esc** cierra primero el menú o la ayuda que esté abierta. En el lienzo cancela el destino o extremo pendiente, o limpia la selección cuando no hay una operación en curso.

El inspector múltiple muestra el total y el recuento por tipo. **Etiqueta común** aplica un mismo texto al conjunto. Las coordenadas para nudos y las longitudes y ángulos para barras son de solo lectura. Si sus valores difieren, se muestran como **Valores distintos**.

**Atajos** abre la ayuda de selección, dibujo, navegación, Snap y UCS desde la barra inferior. En **Resolver** se muestran los resultados y balances. **Aprender** añade el detalle matemático del mismo cálculo.

Usa **Deshacer** y **Rehacer** en la barra superior para recorrer hasta 100 ediciones del modelo durante la sesión. Los atajos son **Ctrl/Cmd + Z** para deshacer y **Ctrl + Y** o **Ctrl/Cmd + Mayús + Z** para rehacer. Cada creación, movimiento, cambio de etiqueta o borrado confirmado cuenta como un paso. Una edición nueva descarta las operaciones que podían rehacerse. La cámara, el UCS y las preferencias de Snap conservan sus valores actuales. Mientras editas un campo de texto, los atajos conservan su comportamiento nativo.

### Grid Snap y Object Snap

- **F9** activa o desactiva **Grid Snap** desde el lienzo o desde el menú **Snap**. Empieza activo con un paso de 1,00 m por eje. En **Snap → Configurar Snap…** puedes elegir 0,10, 0,25, 0,50 o 1,00 m, o aplicar incrementos X e Y distintos. La retícula de ajuste se mide desde el origen global. El botón **Cuadrícula visual** controla por separado la visibilidad y muestra el espaciado.
- **F3** activa o desactiva **Object Snap**. En su menú puedes conmutar extremo, punto medio e intersección por separado. La tolerancia visual predeterminada es 10 píxeles CSS y se puede ajustar entre 1 y 50 px. La referencia habilitada más cercana tiene prioridad sobre Grid Snap. Cuando no hay referencias válidas, se aplica Grid Snap si está activo. Con ambos ajustes inactivos, el clic usa la posición libre.
- La barra inferior muestra las coordenadas que se aplicarán y el tipo de ajuste. Las coordenadas escritas se aplican directamente. Crear un nudo en una intersección conserva la conectividad de las barras que se cruzan.

Si dos nudos quedan superpuestos después de mover uno, el lienzo muestra una advertencia ámbar. En **Inspector → Nudos superpuestos** puedes seleccionar cada nudo por su ID, incluso cuando ambos ocupan el mismo punto. La advertencia desaparece al separarlos.

### Apoyos nodales

1. Abre **Apoyo**, elige **Articulado**, **Rodillo** o **Empotrado** y selecciona un nudo existente. Confirma con **Asignar apoyo** o **Aplicar cambios al apoyo** si ya existe uno.
2. Para un rodillo, introduce en grados la inclinación de su superficie desde +X global, positiva en sentido antihorario. Con 0°, la superficie es horizontal y restringe el desplazamiento vertical. La flecha discontinua del símbolo indica la normal a la superficie.
3. Con **Seleccionar (V)**, pulsa sobre el nudo para consultar el apoyo. Usa **Editar apoyo** y **Aplicar cambios al apoyo** para reemplazar el tipo o cambiar la inclinación. Pulsa **Quitar apoyo** para conservar el nudo sin su apoyo.

Cada nudo admite un apoyo. Al moverlo, el apoyo conserva su orientación global. Al borrar el nudo se borran también su apoyo y sus barras incidentes, recuperables juntos con **Deshacer**. Para distinguir apoyos de nudos que coinciden, selecciona cada ID en **Nudos superpuestos**.

### Cargas estructurales

Abre **Carga** y elige el subtipo. Al seleccionar el nudo o la barra que requiere el comando se abre su formulario contextual. Cada nueva fuerza parte en global a **270°** y con magnitud cero. Introduce la magnitud para ver la flecha hacia abajo o ajusta el ángulo, la rueda o las componentes. La vista previa cambia con los valores. Confirma para guardar o pulsa **Esc** para cancelar. [Guía con ejemplos reproducibles](docs/LOADS_USAGE.md)

Los menús de **Apoyo** y **Carga** se abren también con **Entrar**, **Espacio** o **Flecha abajo** desde el botón enfocado. Las flechas recorren las opciones y **Esc** devuelve el foco al botón. Los atajos **A** y **C** conservan el acceso directo a las herramientas de asignación desde teclado.

En **Seleccionar (V)**, pulsa el trazo de una carga para editarla directamente. **Ctrl/Cmd + clic** alterna y **Mayús + clic** añade. Si coinciden varios trazos o un trazo coincide con el nudo o la barra, **Alt + clic** prioriza las cargas en ese punto y permite recorrerlas. También puedes elegir el ID desde el Inspector del elemento asociado.

- **Nodal.** Introduce Fx y Fy en kN y Mz en kN·m. Los ejes son globales y el momento positivo gira en sentido antihorario.
- **Puntual en barra.** Indica la distancia en metros desde el nudo inicial y las componentes en kN. El Inspector calcula el porcentaje a partir de la longitud actual.
- **Distribuida en barra.** Indica el tramo en metros y las intensidades en kN/m. El perfil uniforme usa una intensidad en todo el intervalo y el variable interpola las componentes entre los extremos.

Las componentes de una carga sobre barra pueden usar ejes globales o locales. El formulario interpreta los números en el sistema elegido. Si un movimiento deja una carga fuera de la barra, el editor rechaza el movimiento completo e indica qué carga debes ajustar. Deshacer y Rehacer restauran las cargas junto con el resto del modelo.

### Edición avanzada

- **Clic derecho** abre las acciones del comando, objeto o selección bajo el cursor. Cuando una carga se superpone a una barra, su menú permite consultar, dividir o invertir explícitamente la barra.
- **Ctrl/Cmd + C** copia una selección. **Ctrl/Cmd + V** abre la inserción con Snap o desplazamiento numérico. El pegado genera IDs nuevos y conserva apoyos, cargas y referencias internas.
- **Dividir barra** acepta distancia desde el inicio, clic sobre el tramo o punto medio. **Invertir sentido** conserva la posición y dirección físicas de las cargas.
- **Modo de cotas** en la barra inferior oculta las cotas existentes, muestra las de la selección o muestra las de las barras visibles. Durante el dibujo de barras siempre se muestran las cotas del destino ajustado.

## Analizar una estructura

1. Selecciona una barra y abre **Propiedades mecánicas** en el Inspector. Elige **Armadura 2D** o **Pórtico 2D**. Introduce E en GPa, A en cm² y, para pórticos, I en cm⁴. Confirma con **Guardar propiedades**.
2. Con varias barras seleccionadas, el formulario muestra los valores comunes. **Aplicar a las barras seleccionadas** confirma en un solo paso los cambios que escribiste.
3. Pulsa **Analizar estructura**. El panel independiente **Resultados** muestra desplazamientos, reacciones, esfuerzos, balances y diagnósticos. Puedes configurar el caso activo antes de volver a calcular.
4. Selecciona una barra o un nudo desde el panel para resaltarlo en el modelo. En un pórtico, consulta una estación en metros desde el extremo inicial. En **Aprender**, puedes recorrer la traza y copiar bloques de matrices.

Los resultados se marcan como desactualizados cuando cambia el modelo físico o el caso de carga. Consulta la [guía de análisis](docs/USER_GUIDE.md) para configurar y comprobar una viga con un ejemplo reproducible.

## Proyectos locales y archivos JSON

Abre **Proyectos** en la barra superior para crear, guardar, renombrar, abrir, duplicar y eliminar proyectos. Los cambios confirmados se autoguardan en IndexedDB. El indicador muestra si hay cambios pendientes, confirmación de guardado o un error. Al abrir o recuperar un proyecto, se inicia un historial de sesión nuevo.

En este incremento local, **Exportar JSON** crea una copia de esquema 5 con la mecánica, la biblioteca y los datos de diseño confirmados. **Importar JSON** valida todo el documento, admite los esquemas 1 a 5 y crea un ID nuevo si ya existe localmente. Los datos locales dependen del origen web y del perfil de navegador. [Pórtico con apoyos y cargas](examples/portico.json) · [Documento vacío](examples/vacio.json)

En **Biblioteca de materiales y secciones** puedes crear materiales y dibujar secciones con dimensiones numéricas. En el Inspector, **Asignación desde biblioteca** permite confirmar material, sección y eje de flexión. [Biblioteca](docs/HITO_5_2_MATERIAL_LIBRARY.md) · [Editor de secciones](docs/HITO_5_3_SECTION_EDITOR.md)

## Verificar y preparar GitHub Pages

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

La compilación se genera en `dist/` y utiliza la subruta fija `/aula-estructural/`. Abre `http://localhost:4173/aula-estructural/` para previsualizar la compilación de producción con esa misma subruta. [Guía de despliegue estático de Vite](https://vite.dev/guide/static-deploy.html#github-pages)

El flujo de Pages se ejecuta manualmente. Consulta los pasos para conectar GitHub, conservar la URL y recuperar una versión anterior. [Guía de publicación de la beta](docs/PUBLIC_BETA.md) · [Flujo manual](.github/workflows/pages.yml)

### Pruebas funcionales

```sh
npx playwright install chromium
npm run test:e2e
```

Para verificar Firefox en PowerShell, instala el navegador de Playwright con `npx playwright install firefox`, define `$env:AULA_E2E_BROWSER='firefox'` y ejecuta `npm run test:e2e`. Para usar Edge, conserva el navegador predeterminado y define `$env:AULA_E2E_CHANNEL='msedge'`.

Playwright compila la aplicación mediante el script de npm y abre una vista previa temporal en `127.0.0.1:4189`. Para usar Microsoft Edge instalado, establece `AULA_E2E_CHANNEL=msedge` antes de ejecutar el script. En PowerShell, usa `$env:AULA_E2E_CHANNEL = 'msedge'`. [Navegadores de Playwright](https://playwright.dev/docs/browsers)

## Documentación

- [Integración y aceptación de los hitos 4.4 y 4.5](docs/HITO_4_4_4_5_INTEGRATION.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Hoja de ruta](docs/DEVELOPMENT_ROADMAP.md)
- [Informe de aceptación del Hito 1](docs/HITO_1_ACCEPTANCE.md)
- [Auditoría final del Hito 1](docs/HITO_1_FINAL_AUDIT.md)
- [Entrega del historial de edición del Hito 2.1](docs/HITO_2_1_HISTORY.md)
- [Entrega de apoyos nodales del Hito 2.2](docs/HITO_2_2_SUPPORTS.md)
- [Informe de implementación y matriz del Hito 2.2](docs/HITO_2_2_IMPLEMENTATION.md)
- [Informe de implementación y matriz del Hito 2.3](docs/HITO_2_3_LOADS.md)
- [Edición CAD avanzada](docs/HITO_2_4_CAD_EDITION.md)
- [Aceptación integral del Hito 2](docs/HITO_2_FINAL_ACCEPTANCE.md)
- [Persistencia y aceptación del Hito 3](docs/HITO_3_FINAL_ACCEPTANCE.md)
- [Documento maestro](docs/requisitos/DOCUMENTO_MAESTRO_2026-11-21.md) y [adenda de requisitos](docs/requisitos/ADENDA_REQUISITOS_2026-11-21.md) del 21/11/2026.
