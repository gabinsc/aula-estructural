# Hito 7.5 · Auditoría matemática transversal

## Alcance y línea base

Se auditaron rigideces, trabajo virtual, método de las fuerzas, líneas de influencia con trenes y Hardy Cross. El punto de partida recuperable es `d3997d3`, punta de la rama local `hitos-7.3-7.4`. Un índice temporal confirmó que el contenido de trabajo coincidía con ese commit antes de incorporar los ensayos. Los cambios locales previos, la rama activa `main` y su índice se conservaron.

La auditoría cotejó el alcance y las convenciones del producto con el documento maestro, la adenda y los informes de los hitos anteriores. La comprobación combina referencias analíticas independientes, comparación entre procedimientos aplicables y revisión de las salidas educativas y su ciclo de vigencia. Se conservaron los oráculos anteriores. [Maestro](requisitos/DOCUMENTO_MAESTRO_2026-11-21.md) · [Adenda](requisitos/ADENDA_REQUISITOS_2026-11-21.md) · [Arquitectura 4](HITO_4_ANALYSIS_ARCHITECTURE.md) · [Motor 4.3](HITO_4_3_FRAME_ENGINE.md) · [Integración 4.4–4.5](HITO_4_4_4_5_INTEGRATION.md) · [AVM 4.6](HITO_4_6_AVM_DIAGRAMS.md) · [Rigideces 5.1](HITO_5_1_EDUCATIONAL_STIFFNESS.md) · [Materiales 5.2](HITO_5_2_MATERIAL_LIBRARY.md) · [Secciones 5.3](HITO_5_3_SECTION_EDITOR.md) · [Auditoría 6](HITO_6_FINAL_AUDIT.md) · [Trabajo virtual 7.1](HITO_7_1_VIRTUAL_WORK.md) · [Fuerzas 7.2](HITO_7_2_FORCE_METHOD.md) · [Influencia 7.3](HITO_7_3_INFLUENCE_LINES.md) · [Cross 7.4](HITO_7_4_MOMENT_DISTRIBUTION.md)

## Convenciones y tolerancias

- Las coordenadas globales crecen hacia +X a la derecha y +Y hacia arriba. Fuerzas, longitudes, momentos y giros se calculan en N, m, N·m y rad. La interfaz aplica factores de presentación a kN, kN·m y mm. Para rodillos, restringe la normal de la superficie y permite su tangente. Las coordenadas globales conservan su sentido al cambiar UCS.
- El eje local de barra va de i a j. El axial positivo indica tracción. Con la convención de corte, V positivo en el izquierdo de la viga simple bajo carga descendente y M positivo sagante. La fuerza puntual transversal introduce un salto en V. Los momentos de extremo de Cross son acciones nodales antihorarias positivas. Por ello `M(0⁺) = −Mᵢ` y `M(L⁻) = Mⱼ`.
- La comparación de nuevos oráculos usa un piso de `10⁻⁶` N o N·m, `10⁻¹⁰` m o rad y `10⁻¹²` en unidades de flexibilidad, más `10⁻⁸ × |valor esperado|`. Para las consultas de cortante móvil se usa un piso de `10⁻⁸` en unidades de ordenada o de fuerza, según el caso. Los pisos separan redondeo cerca de cero del error relativo y quedan por debajo de la resolución visible de los ejemplos. Cada prueba conserva el valor esperado con su precisión física.
- Rigideces verifica componentes de equilibrio, residuo libre y compatibilidad. Se equilibra la matriz antes de Cholesky, con residuo hacia atrás de hasta `10⁻¹⁰`, aviso por condición recíproca estimada inferior a `10⁻⁸` y rechazo por debajo de `10⁻¹²`. Se respetaron las tolerancias de verificación de secciones del Hito 4.3. [Control numérico](HITO_4_CONTINUITY.md) · [Secciones](HITO_4_3_FRAME_ENGINE.md)

## Matriz de aplicabilidad y casos analíticos

**✓** indica que el procedimiento se aplica a la consulta indicada. **D** identifica una condición que se diagnostica al solicitarla. **A** indica un caso aplicable con la consulta descrita. Las cargas móviles constituyen casos separados del caso estático. E = 200 GPa. A = 0,02 m² e I = 8·10⁻⁶ m⁴ en las vigas nuevas, salvo indicación específica. En armaduras del catálogo, A = 0,001 m².

| Problema | Rigideces | Trabajo virtual | Fuerzas | Influencia | Cross | Referencia independiente contrastada |
| --- | --- | --- | --- | --- | --- | --- |
| Barra axial de 2 m con ±10 kN | ✓ N, u | ✓ u | D · liberación desestabiliza | D · camino axial sin carga interior | D · armadura | Equilibrio: N = ±10 kN. Ley axial: u = PL/EA = ±0,1 mm. |
| Armadura triangular de base 4 m y altura 3 m, 12 kN descendentes en vértice | ✓ R, N, u | ✓ u | D · apoyos necesarios | D · camino axial | D · armadura | Método de nudos: Ry = 6 kN en ambos apoyos. Base +4 kN, diagonales −2√13 kN. Suma de trabajos: uy = −0,182907 mm. |
| Simple de 6 m con 12 kN en el centro | ✓ R, V, M, v | ✓ v y giro | D · sin liberación estable | ✓ Ry, V y M | ✓ | Equilibrio: Ry = 6 kN, V = +6/−6 kN, M = 18 kN·m. Curvatura: v = −PL³/(48EI) = −33,75 mm, giro central nulo. |
| Dos vanos de 4 m, 5 kN/m | ✓ R y M | ✓ giro exterior | ✓ reacción interior | ✓ Ry central con barra invertida | ✓ | Tres momentos y compatibilidad dan 7,5 kN en cada apoyo exterior, 25 kN en el interior y momento central de −10 kN·m. Ordenada de Ry central en el primer vano: a(3L²−a²)/(2L³). Giro exterior izquierdo −qL³/(48EI). |
| Tres vanos de 4 m, 5 kN/m | ✓ R, V, M, giro | ✓ giro | ✓ con una o dos liberaciones | ✓ Ry en N2 y N3 | ✓ | Tres momentos dan M de −8 kN·m en apoyos interiores, 8 kN en cada reacción exterior, 22 kN en cada interior y V de −2 kN en el centro del primer vano. Por curvatura, giro en N2 +1,666667 mrad. |
| Voladizo de 3 m, 8 kN en extremo libre e I = 10⁻⁵ m⁴ | ✓ R, M, v, giro | ✓ v y giro | D · liberación genera mecanismo | ✓ flecha y giro por fuerza móvil | D · el extremo libre produce rotación de cuerda | Equilibrio: Ry = 8 kN, reacción de momento +24 kN·m, M de sección en base −24 kN·m. Integración elástica: uy = −36 mm, giro −18 mrad. |
| Empotrada-apoyada de 4 m, 5 kN/m | ✓ R, M, giro | ✓ giro | ✓ libera rodillo | A · barra cargable | ✓ | Compatibilidad del voladizo: RB = 3qL/8 = 7,5 kN, RA = 12,5 kN, momento de reacción +10 kN·m. Giro en B = qL³/(48EI) = +4,166667 mrad. |
| Pórtico 2 × 2 m arriostrado arriba, bases empotradas, q = 5 kN/m en dintel | ✓ R y M | ✓ giro en N2 | ✓ libera giro de base | A · recorrido explícito | ✓ | Pendiente–deflexión con cuerda compatible da momentos de base de −qL²/36 y +qL²/36 (±0,555556 kN·m). En el nudo superior izquierdo, el giro es −qL³/(72EI). |
| Pórtico 2 × 2 m con traslación lateral, bases empotradas, 10 kN horizontales en cada nudo superior, I = 2·10⁻⁵ m⁴ | ✓ R, u, giro | ✓ ux | ✓ uno o dos giros de base | A · caso lineal sobre camino compatible | D · momentos de cuerda apreciables | Pendiente–deflexión con deformación axial de columnas: ux = 2,384623 mm, giro −0,717956 mrad, Rx de cada base −10 kN, momentos de base +11,435912 kN·m. |
| Voladizo de 3 m con rodillo de superficie a 45° y 8 kN descendentes en extremo | ✓ R, u y restricción | ✓ componentes de trabajo | ✓ libera normal | A · reacción direccional en ruta de pórtico | D · la traslación induce giro de cuerda | Si a = L/EA y b = L³/(3EI), fₙₙ = (a+b)/2, Rₙ = √2·P·b/(a+b), ux = uy = −Pab/(a+b) y Rₓ + Rᵧ = 0 en el rodillo. |

Las celdas **A** documentan aplicabilidad por hipótesis. La evidencia cuantitativa corresponde a los cruces indicados en la última columna y a los ensayos por método. En el conjunto de regresión se cotejan los modelos isostáticos, los casos de carga distribuida uniforme y parcial, el mecanismo y el soporte oblicuo. [Oráculos nuevos](../src/analysis/academicValidation.test.ts) · [Armadura](../src/analysis/truss.test.ts) · [Pórtico](../src/analysis/frame.test.ts) · [Trabajo virtual y fuerzas](../src/analysis/educationalMethods.test.ts) · [Influencia y Cross](../src/analysis/movingMethods.test.ts)

## Comprobación de los procedimientos

### Trabajo virtual y carga unitaria

Una unidad de 1 N en la dirección global de la traslación o de 1 N·m en +Z para el giro se aplica en el sistema virtual, con los mismos vínculos que el sistema real. Una sección interior de pórtico usa un corte temporal con correspondencia de barras y estaciones por ID. El resultado procede de `Σ∫(N·n/EA + M·m/EI) ds`. Las fuerzas internas de ambos sistemas proceden del motor compartido. El desplazamiento de rigideces se utiliza como comprobación posterior.

Los cambios de ley de cualquiera de los dos sistemas separan intervalos. Los extremos se evalúan desde cada tramo, por lo que un salto de V no se suaviza. El axial por cargas distribuidas lineales tiene como máximo grado dos y M grado tres. Los productos alcanzan grado seis y la cuadratura de Gauss con cuatro puntos integra hasta grado siete en aritmética exacta. La armadura bajo cargas nodales aporta `N·n·L/EA`. En el rodillo a 45° se contrastaron por separado los aportes `−P·a·[b/(a+b)]²` y `−P·b·[a/(a+b)]²`. Su suma coincide con la respuesta conjugada. [Integración](../src/analysis/workIntegral.ts) · [Sistema unitario](../src/analysis/virtualWork.ts)

### Método de las fuerzas

La selección de redundantes libera coordenadas de apoyo. Se rechaza la primaria inestable antes de integrar. En una primaria estable, las coordenadas libres tienen rango completo. El grado de hiperestaticidad resulta de restar ese número de coordenadas a la suma de modos elásticos independientes de las barras (uno axial por armadura, tres por pórtico). Así se distingue la viga de tres vanos con dos liberaciones (primaria isostática) de la misma viga con una (primaria hiperestática de grado uno). La variante parcial resuelve la primaria elástica y recupera la misma reacción seleccionada. Las redundancias internas y las liberaciones de extremo quedan fuera del selector.

El oráculo de tres vanos usa la función de Green de una viga simple de longitud 3L, con fuerzas unitarias aplicadas en L y 2L. Da `f₁₁ = f₂₂ = 4L³/(9EI)` y `f₁₂ = f₂₁ = 7L³/(18EI)`. La condición recíproca de la matriz equilibrada es 1/15. Para una fuerza descendente unitaria en L/2, las flechas libres de N2 y N3 son `−19L³/(72EI)` y `−31L³/(144EI)`. Al imponer compatibilidad se obtienen las ordenadas 29/40 y −3/20 para esas reacciones. En la empotrada-apoyada, la flecha libre `−qL⁴/(8EI)` y la flexibilidad positiva `L³/(3EI)` dan 3qL/8. Se comprobó Maxwell–Betti, el residuo de Cholesky, la compatibilidad final nula, reacciones, giros y campos contra rigideces y las referencias independientes. Las tablas indican la respuesta conjugada por unidad de acción de la columna, como rad/(N·m). [Compatibilidad y recuperación](../src/analysis/forceMethod.ts)

### Líneas de influencia y trenes

El camino se construye por IDs. Las barras invertidas conservan su s local y la carga de un nudo compartido actúa una vez. En cada tramo de Euler–Bernoulli el equivalente de una fuerza puntual de dirección fija usa funciones de forma a lo sumo cúbicas en la posición móvil. La solución elástica y la extracción de una respuesta fija son lineales. La aportación directa al corte puede cambiar de expresión cuando el eje pasa de lado, de modo que allí se define otro tramo. Cuatro abscisas interiores identifican el polinomio, una quinta distinta coteja la solución directa y se calculan valores exactos en los eventos. Las raíces interiores de la derivada, los eventos y sus límites son candidatos a extremos. Las ramas monótonas permiten localizar ceros por bisección. En una meseta basta una estación interior para demostrar que el valor se alcanza.

Para fuerzas paralelas, el tren usa `Σ Pᵢ·LI(S−σdᵢ)`. Trasladar cada singularidad permite separar también entrada y salida parciales. Se verificaron trenes de dos y tres ejes con máximos de 35 y 55 N·m en los problemas de referencia. Con ejes de +10 y −20 N separados 2 m, el momento de sección central en la viga de 6 m se anula en S = 10/3 m. El cortante bajo un eje de 20 N reproduce `−20a/L` al aproximarse al corte por la izquierda y `20(1−a/L)` por la derecha. En a = 0,2 m con separación de 100 m, el resultado es −0,666667 N en S = 100,2 m para la consulta de corte derecho y +19,333333 N en su límite derecho. El valor unilateral describe una aproximación dentro del recorrido.

La búsqueda de extremos abarca las piezas representables de esta ley lineal elástica, con las tolerancias de reconstrucción ya documentadas. Una diferencia del orden del redondeo se considera coincidente para elegir un candidato alcanzado. Si Float64 colapsa eventos o las abscisas necesarias, se informa el problema. La referencia de carga cero exterior se representa como límite en los bordes de la ventana de consulta del tren. [Polinomios y extremos](../src/analysis/influenceCurve.ts) · [Casos de carga temporales](../src/analysis/influence.ts)

### Distribución de momentos de Hardy Cross

Se cotejaron los momentos de empotramiento con las primitivas analíticas de las funciones de Hermite para cargas puntuales, uniformes, parciales y lineales. Cada giro libre distribuye el momento corrector con `k = 4EI/L`, factores cuya suma es uno y transporte de 1/2. Los giros se acumulan desde cero. El residuo máximo de desequilibrio se comprueba después de cada barrido contra `10⁻⁹ + 10⁻¹²·Mref` N·m. El tope de 200 barridos produce diagnóstico si el criterio no se alcanza. La redistribución y la recuperación se contrastaron contra pendiente–deflexión, tres momentos y rigideces.

Las traslaciones compatibles proceden del caso elástico de referencia. La prueba de validez usa la traslación **transversal relativa de cada barra** en su eje local y estima `|6EI Δv/L²|`. El método rechaza un aporte superior a `10⁻⁷ + 10⁻⁸·Mref` N·m, aun cuando el movimiento global sea vertical, como en el voladizo bajo fuerza de extremo. El pórtico con traslación lateral se rechazó por esta hipótesis. Tras recuperar reacciones y campos desde los giros de Cross, se verificaron equilibrio, residuos y condiciones de extremo. [Iteración y recuperación](../src/analysis/cross.ts)

## Defectos reproducidos y correcciones

| Hallazgo | Reproducción previa | Corrección |
| --- | --- | --- |
| Pérdida del valor exacto al trasladar un evento decimal del tren | Para el corte a 0,2 m y eje separado 100 m, el error de cortante fue 20 N. Para la línea constante, en el último borde decimal se obtuvo 0 en vez de 2. | Comparación en coordenadas de los eventos trasladados, restauración de la estación física del eje para CAD y caso directo, y validación de abscisas distinguibles. |
| Extremo alcanzado clasificado como límite | Una meseta de valor 4 con bordes exactos de valor cero se etiquetaba como límite derecho. | Se añade el centro de la meseta y se prefiere un candidato alcanzado frente a un límite del mismo valor dentro de la tolerancia de redondeo. |
| Corte representable confundido con un nudo | Para s = 6 − 32ε m sobre viga de 6 m, el límite posterior del salto tenía error unitario. | Comparación exacta de estaciones representables y quinta abscisa de control separada de las de ajuste. |
| Lectura educativa ambigua al liberar apoyos | La vista omitía el grado de la primaria y las unidades de los aportes de la celda seleccionada. | Se presenta la clasificación de la primaria estable y se identifican las unidades conjugadas de los trabajos y coeficientes. |

## Consistencia educativa y regresiones

La inspección y las pruebas de navegador verifican que **Resolver** muestra el resultado del método activo y sus comprobaciones, mientras **Aprender** añade los productos de campos, la matriz de flexibilidad, la ordenada móvil o los barridos correspondientes. Los controles enlazan con nudos, barras y estaciones del caso. La revisión del Worker incorpora el modelo, el caso y las opciones del método. Al cambiar alguno, se invalida el resultado y se ignoran respuestas que pertenecen a cálculos anteriores. La navegación entre tablas, el movimiento de la carga virtual y la visualización conservan el documento y su historial. [Flujo de vigencia](../src/app/results/useAnalysis.ts) · [Métodos en navegador](../tests/e2e/methods.spec.ts) · [Tren y Cross en navegador](../tests/e2e/movingMethods.spec.ts)

La suite de regresión cubre CAD, apoyos y cargas, biblioteca, editor de secciones, AVM y deformadas, Undo/Redo, IndexedDB, JSON v3, Worker, ejemplos académicos y vigencia. [Pruebas de interfaz](../tests/e2e/)

### Pruebas antes y después

La línea base pasó 219 pruebas Vitest, 65 Playwright en Edge, 65 en Chromium y 20 representativas en Firefox, además de TypeScript y compilación de producción. La auditoría añadió 13 ensayos Vitest y un escenario Playwright. Antes de los arreglos, los ensayos nuevos reprodujeron los errores decimales, la etiqueta de la meseta y el salto confundido cerca del nudo.

| Verificación | Antes | Después |
| --- | --- | --- |
| Vitest | 219 aprobadas | 232 aprobadas |
| Playwright Edge | 65 aprobadas | 66 aprobadas |
| Playwright Chromium | 65 aprobadas | 66 aprobadas |
| Playwright Firefox, selección representativa | 20 aprobadas | 21 aprobadas |
| TypeScript | Correcto | Correcto |
| Compilación Vite para producción | Correcta | Correcta |

Firefox se ejecutó con un trabajador por los dos fallos intermitentes y el error del compositor gráfico registrados en el Hito 7.4. En esta auditoría pasaron tanto las 20 pruebas de línea base como las 21 posteriores, sin reproducir el problema gráfico. Los primeros intentos en Edge y Chromium del escenario nuevo omitían seleccionar la entidad objetivo. El editor devolvió el diagnóstico esperado. Se corrigió la preparación de la prueba y se conservó la expectativa numérica.

## Límites y riesgos pendientes

- Se mantuvo elasticidad lineal de primer orden, barras prismáticas y el modelo de Euler–Bernoulli. Asentamientos, plasticidad, segundo orden, deformación de cortante, contacto unilateral, liberaciones internas y verificación normativa quedan fuera del alcance auditado.
- Influencia admite hasta 24 barras de pórtico y 160 grados activos, con hasta 16 ejes paralelos de fuerza firmada. Estaciones separadas por muy pocas unidades de redondeo pueden recibir un diagnóstico. Una reconstrucción y su muestra de control acotan la comprobación numérica en los casos admitidos, sin certificar cada modelo mal escalado posible.
- La recuperación por fuerzas y Cross usa el motor común para los sistemas auxiliares, la cinemática compatible o el equilibrio. Los oráculos independientes reducen el riesgo de errores compartidos. Los modelos con flexibilidad mal condicionada o cuerda incompatible deben interpretarse por su diagnóstico.

## Matriz de aceptación y dictamen

| Requisito | Resultado | Evidencia |
| --- | --- | --- |
| Referencias independientes y comparación física | Conforme en el alcance auditado | Matriz de diez problemas, ensayos anteriores conservados y oráculos nuevos. |
| Trabajo virtual y unidades conjugadas | Conforme | Producto axial y flexional, partición, giro, aporte por barra y reacción sobre rodillo inclinado. |
| Fuerzas y distinguibilidad de la primaria | Conforme | Tres vanos con una y dos liberaciones, coeficientes de Green, reciprocidad, compatibilidad y diagnóstico. |
| Influencia y trenes | Conforme tras corrección | Saltos, inversión, oráculos directos, eventos decimales, meseta y pruebas de navegador. |
| Hardy Cross | Conforme para casos compatibles | Rigideces de extremo, transporte, convergencia y rechazo por rotación de cuerda. |
| Coherencia educativa y vigencia | Conforme | Métodos, unidades, enlaces por ID y regresiones de revisión. |
| Regresión del editor, cálculo y persistencia | Conforme | Vitest, Playwright, TypeScript y compilación de producción. |

**Dictamen. APTO para el cierre del Hito 7.5 dentro del alcance académico documentado.** Los métodos aplicables reprodujeron las referencias independientes y las comparaciones transversales quedaron dentro de las tolerancias declaradas. Se verificaron los diagnósticos de alcance y se corrigieron los defectos reproducidos. La entrega se registró de forma local.
