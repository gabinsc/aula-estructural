# Hito 8.1 · Fundamentos de diseño estructural

## Uso

1. Asigna una sección y un material desde la biblioteca si quieres consultar sus referencias. Para la flexión, el pórtico requiere una sección con contorno y el eje principal elegido en la asignación.
2. Abre **Diseño estructural** en la barra superior, selecciona una barra en el lienzo o en la lista y pulsa **Analizar estructura**. Puedes utilizar un resultado vigente de un caso estático ya calculado.
3. Introduce la estación en metros desde el nudo inicial y selecciona el lado del corte. **Ver sección en AVM** abre el mismo corte en Resultados. Al volver a Diseño, puedes recuperar ese corte.
4. Si el ejercicio lo requiere, guarda resistencias del material y un criterio explícito. Los límites de tracción y compresión se comparan con las fibras críticas de toda la barra. El límite de servicio se consulta en la estación seleccionada.

Las comparaciones se limitan a la evaluación elástica de una sección homogénea sin fisuración y a los límites declarados por el usuario.

## Arquitectura y trazabilidad

`src/design` define contratos independientes de React, SVG y del almacenamiento. El módulo consume los resultados del análisis aprobados en el Hito 7.5, incluidos los campos de sección de pórtico, y los consulta mediante sus funciones existentes. La evaluación es de solo lectura. Los métodos estáticos disponibles en el análisis pueden suministrar esfuerzos vigentes. Las ordenadas de influencia se excluyen por corresponder a una respuesta móvil de otro tipo.

La línea base de Git es `c88a8aa`. Se conservaron las formulaciones del análisis y las convenciones globales y locales del proyecto. [Documento maestro](requisitos/DOCUMENTO_MAESTRO_2026-11-21.md) · [Adenda](requisitos/ADENDA_REQUISITOS_2026-11-21.md) · [Hoja de ruta](DEVELOPMENT_ROADMAP.md) · [Auditoría del Hito 7.5](HITO_7_5_ACADEMIC_VALIDATION.md)

El resultado identifica el proyecto, caso de carga, revisión física, revisión del análisis, barra, material, sección y criterio cuando están disponibles. Cada consulta y cada extremo conserva estación y lado. La vigencia se valida contra la revisión que gestiona el Worker. Cambiar la geometría, el material o la sección de análisis, el caso activo o el método invalida la consulta si cambia esa revisión. Los cambios confirmados de resistencias o límites regeneran la consulta a partir del análisis aún vigente. Las tensiones no dependen de un valor resistente declarado.

Los parámetros de diseño se guardan en `ProjectDocument.design` (JSON v4), separados de `Structure`. Incluyen resistencias por ID de material y un criterio por proyecto. Se validan en importaciones, guardado automático y copias. Los proyectos v1, v2 y v3 migran sin añadir resistencias, límites ni asignaciones. El ID de material permanece registrado aunque su entrada se desasigne o se elimine, y los datos solo se aplican con una asignación activa al mismo ID. El cálculo y la posición de consulta pertenecen a la sesión. IndexedDB conserva sus almacenes, transacciones y revisiones de concurrencia. [Contratos](../src/design/contracts.ts) · [Evaluador](../src/design/evaluate.ts) · [Validación y migración](../src/projects/document.ts)

## Fórmulas y convenciones

- **Axial**. `σN = N/A`. N positivo produce tracción. Se usa el área mecánica de la asignación vigente, incluida un área manual. La armadura aporta únicamente tensión axial uniforme.
- **Flexión uniaxial**. El eje local de la barra apunta de i a j. Con el momento sagante positivo del motor, `σM = −M·y/I`. El punto de coordenada y positiva comprime bajo un momento positivo. La tensión combinada es `σN + σM`. Al invertir una barra simétrica, las fibras referidas a los nuevos ejes locales se intercambian y la misma fibra física conserva su tensión. En una sección asimétrica la orientación se interpreta respecto a los ejes locales de la asignación.
- **Fibras y módulo resistente**. Para el eje centroidal x de la biblioteca se toma como fibra positiva la dirección +y de la sección. Para el eje centroidal y se toma +x. El evaluador proyecta el contorno sólido, mide ambas distancias positivas desde el centroide y calcula `S⁺ = I/c⁺` y `S⁻ = I/c⁻`. Los huecos validados no añaden contorno exterior. Se exige enlace coherente con el área y la inercia del análisis y `|Ixy| ≤ 64·ε·√Ixx·√Iyy` para identificar un eje principal dentro del redondeo.
- **Extremos en la barra**. Se evalúan los extremos del elemento, ambos lados de discontinuidades y los límites de cada intervalo de carga. Para cada fibra, `dσ/ds = −qx/A − y·V/I`, con `dM/ds = V`, `dV/ds = qy` y `dN/ds = −qx` bajo la convención existente. Como qx y qy son lineales por tramo, el derivado es a lo sumo cuadrático. Se resuelven sus raíces interiores y se evalúa la tensión en ellas mediante el motor. Esta búsqueda distingue el máximo de tensión combinada del máximo de momento.
- **Servicio puntual**. Se muestra el desplazamiento transversal absoluto `v(s)` en y local y la desviación respecto a la cuerda deformada `v(s) − [(1−s/L)·vi + (s/L)·vj]`. El criterio compara el valor absoluto de la modalidad elegida en esa estación. La cuerda de referencia corresponde a esa barra. Una viga formada por varias barras requiere definir otra referencia para comprobar una flecha de vano.

Las unidades internas son N, N·m, m y Pa. El panel presenta acciones en kN y kN·m, tensiones en MPa, distancias en mm o m, y módulos resistentes en cm³. Se usa `1 MPa = 10⁶ Pa`. [MIT OpenCourseWare · Tensiones en vigas](https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/96d839b02e4a6c63cf8031800e89cccd_MIT3_11F99_bstress.pdf)

## Resistencias y criterio

Se pueden declarar fy, fu y resistencia a compresión por material. Se guarda la fuente textual y su procedencia, como ilustrativa, declarada o normativa verificada por el usuario. La etiqueta normativa registra esa declaración y su referencia. El módulo carece de comprobación documental de la fuente. Los materiales previos conservan E y sus metadatos. Una hoja de datos elástica de ejemplo no crea resistencias.

Los límites de tensión y compresión del criterio son magnitudes positivas independientes de las resistencias registradas. En la barra se compara la mayor tracción o la mayor magnitud de compresión. El estado dice **Dentro del límite declarado** o **Excede el límite declarado** para esa comprobación concreta. En servicio se exige un desplazamiento admisible en mm y una referencia explícita.

## Diagnósticos y límites

| Situación | Salida |
| --- | --- |
| Análisis ausente, desactualizado o de influencia | Se ocultan acciones, tensiones y comparaciones. La configuración sigue disponible. |
| Estación fuera de `[0,L]` | Se solicita corregir la posición. En i y j se usa el lado interior de la barra. |
| Pórtico con A e I manuales, contorno ausente o eje incompatible | Se muestra solo el aporte axial y, cuando existe, el campo de servicio. Se omiten las comparaciones resistentes de flexión combinada. |
| Armadura | Se muestra N y tensión axial. V, M y servicio transversal quedan fuera del modelo. |
| Rango numérico no representable | Se informa el diagnóstico y se omiten los resultados afectados. |

Quedan fuera el diseño normativo, combinaciones y factores de resistencia, cortante resistente, pandeo, flexión acoplada, resultantes fuera del plano, concreto armado fisurado y flecha de vano en cadenas de varias barras. El panel muestra V como acción del análisis. La evaluación de tensiones de este hito es normal longitudinal.

## Casos de referencia y aceptación

| Verificación | Oráculo y evidencia |
| --- | --- |
| Tracción, compresión y MPa | ±120 kN en 0,02 m² producen ±6 MPa. |
| Rectángulo y axial combinado | 0,2 × 0,4 m y M = 12 kN·m producen ±2,25 MPa. Con N = 160 kN resultan −0,25 y +4,25 MPa. |
| Perfil I y T | Contraste con el rectángulo menos dos huecos laterales para I, y dos rectángulos con ejes paralelos para T. En el perfil T de referencia se obtienen c⁺ = 0,15 m y c⁻ = 0,25 m. |
| Inversión y lados | Inversión del signo local de M y correspondencia entre fibras físicas. Una carga puntual comprueba los saltos axial y cortante. |
| Extremos con acción variable | Cargas distribuidas axial y transversal desplazan ambas estaciones críticas de L/2. Una carga triangular produce el extremo de flexión en L/√3. |
| Servicio | En voladizo, contraste de la elástica por integración y resta de la cuerda mediante los desplazamientos de sus extremos. |
| Datos insuficientes o inválidos | Diagnósticos para sección manual, eje no principal, cambio de caso y estación fuera de intervalo. |
| Persistencia y vigencia | Migración v1–v3, v4 con unidades SI, edición explícita de fy, recarga de IndexedDB y exportación/reimportación en navegador. |
| Accesibilidad y AVM | Consulta desde corte, devolución a AVM, apertura y foco en viewport de 320 px. |

[Oráculos matemáticos](../src/design/evaluate.test.ts) · [Migración](../src/projects/document.test.ts) · [Pruebas de interfaz](../tests/e2e/design.spec.ts) · [Auditoría del motor](HITO_7_5_ACADEMIC_VALIDATION.md)

## Regresión y dictamen

| Verificación | Línea base | Hito 8.1 |
| --- | --- | --- |
| Vitest | 232 aprobadas | 246 aprobadas |
| Playwright Edge | 66 aprobadas | 68 aprobadas |
| Playwright Chromium | 66 aprobadas | 68 aprobadas |
| Playwright Firefox, selección en serie | 21 aprobadas | 23 aprobadas |
| TypeScript | Correcto | Correcto |
| Compilación Vite bajo la subruta de Pages | Correcta | Correcta |

El primer pase de Firefox de la línea base mezcló un fixture generado por el código v4 con la compilación v3. La repetición aisló el commit de referencia y reprodujo las 21 pruebas. En ambas líneas se usó un trabajador en Firefox. El motor, sus pruebas y su Worker conservaron el código del Hito 7.5.

**Dictamen. Hito 8.1 verificado dentro del alcance elástico documentado.** El usuario puede reproducir las tensiones desde las acciones vigentes, examinar las fibras críticas y comparar contra límites explícitos. El proyecto conserva las declaraciones de diseño al guardar y cargar y exige un análisis nuevo al reabrirlo. La entrega quedó en el repositorio local.
