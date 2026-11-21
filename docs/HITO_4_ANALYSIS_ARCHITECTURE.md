# Hito 4 · Arquitectura del motor de análisis estructural 2D

**Estado · Propuesta para revisión técnica.** El alcance propuesto es análisis elástico lineal de primer orden, con pequeñas deformaciones, barras de armadura axial y elementos de pórtico Euler–Bernoulli prismáticos. El documento fija un contrato de implementación y pruebas de referencia. La intervención se limita a documentación.

## 1. Línea base comprobada

| Área | Evidencia de código | Resultado y alcance |
| --- | --- | --- |
| `Structure`, nudos y barras | [Dominio estructural](../src/domain/structure.ts) y [validador del documento](../src/projects/document.ts) | Nudos globales en m, barras por IDs de extremo, contadores y colecciones de apoyos y cargas. La validación distingue longitud nula, referencias inválidas y duplicados. Cruces y superposiciones no crean conexión. |
| Marcos global y local | [Transformaciones y geometría](../src/geometry/coordinates.ts) | El eje local de barra parte del extremo inicial. X local apunta al final y Y local es su normal antihoraria. Cámara y UCS pertenecen a la interacción y no forman parte de la entrada física del motor. |
| Restricciones | [Apoyos](../src/domain/support.ts) | Articulado restringe X/Y, empotrado también giro y rodillo restringe la normal de la superficie en global. La inclinación almacenada es la de la superficie, no la de la normal. |
| Fuerzas y momentos nodales | [Dominio de cargas](../src/domain/load.ts) | Fuerza global en N y momento nodal en N·m con signo antihorario. Se admiten varias cargas por nudo. |
| Cargas de barra | [Cargas](../src/domain/load.ts) y [edición de barras](../src/domain/barEdition.ts) | Puntuales por distancia física `s`, distribuidas lineales o uniformes por intervalo `[s0,s1]`. Marcos global y local, intensidades en N/m. Las pruebas actuales verifican reasignación, inversión y conservación física. |
| Historial | [Undo/Redo](../src/modeler/tools/history.ts) | Instantáneas inmutables del modelo, con transacciones por cambio efectivo. Las pruebas de persistencia comprueban el reinicio del historial al reabrir. |
| Persistencia e intercambio JSON | [Esquema 1](../src/projects/document.ts), [IndexedDB](../src/infrastructure/projectStore.ts) y [flujo de navegador](../tests/e2e/projects.spec.ts) | Validación antes de abrir, autoguardado local y revisión contra escrituras de otra pestaña. Exportar e importar conserva el modelo físico. Para el análisis todavía faltan tipo resistente y propiedades mecánicas. |

Se cotejaron los informes de aceptación de los Hitos 2 y 3, el documento maestro y su adenda. El Hito 3 acredita producción local y mantiene la ejecución remota de Pages pendiente. La compilación se volvió a ejecutar en la suite de navegador. En Node.js 24.22.1 pasaron **94 Vitest**, **35 Playwright en Edge para Windows**, **TypeScript** y **compilación de producción**. Los resultados corresponden al editor y la persistencia existentes. El commit de referencia es `f676688`, con cambios previos de los Hitos 2 y 3 en la copia de trabajo y sin remoto configurado. [Aceptación Hito 2](HITO_2_FINAL_ACCEPTANCE.md) · [Aceptación Hito 3](HITO_3_FINAL_ACCEPTANCE.md) · [Documento maestro](requisitos/DOCUMENTO_MAESTRO_2026-11-21.md) · [Adenda](requisitos/ADENDA_REQUISITOS_2026-11-21.md)

## 2. Contratos y dependencias

Se propone conservar `Structure` como fuente de geometría, topología, apoyos y cargas. Una definición mecánica separada por ID de barra evita duplicar entidades CAD y permite volver a usar el mismo modelo con asignaciones explícitas. El adaptador de entrada combinará una instantánea del documento y la definición de análisis. Las fases de ensamblaje y recuperación trabajarán con un modelo preparado e inmutable.

| Entidad propuesta | Contenido y reglas |
| --- | --- |
| `AnalysisDefinition` | Versión de la definición y asignaciones por `barId`. Cada asignación declara `truss2d` o `frame2d`, E en Pa y A en m², todas finitas y positivas. `frame2d` exige además I en m⁴ respecto de Z local. En el primer incremento basta asignar valores efectivos por barra. Los catálogos futuros podrán resolver valores hacia el mismo contrato. |
| `AnalysisCase` | Identidad de caso y cargas de origen por ID. El primer alcance resuelve un caso explícito con todas las cargas definidas. Las familias de casos, combinaciones, factores y peso propio quedan para una decisión posterior. |
| `AnalysisInput` | Modelo validado, definición, caso, opciones numéricas y revisión semántica de la instantánea. Sin coordenadas de pantalla, UCS, selección, estado de formularios ni preferencias visuales. |
| `PreparedModel` | Índices de nudos, barras y cargas, componentes conectadas por ID, geometría local, índices de grados de libertad, normal de apoyo y vectores por elemento. Se vuelve a validar al preparar. Usar `Structure` como tipo TypeScript no sustituye las comprobaciones físicas. |
| `AnalysisResult` | Resultado satisfactorio con desplazamientos, reacciones, esfuerzos, medidas de calidad y traza opcional, o resultado fallido con diagnósticos y procedencia. Identifica caso, revisión física y versión del motor. |

```text
Editor / IndexedDB / JSON → Structure validada + AnalysisDefinition + AnalysisCase
  → aplicación de análisis → preparación y mapa de grados de libertad
  → formulaciones de elemento + cargas consistentes → ensamblaje
  → reducción de restricciones → álgebra lineal → recuperación y controles
  → resultados por ID + traza opcional → interfaz Resolver / Aprender
```

- Ruta propuesta `src/analysis/` para elementos, restricciones, ensamblaje, diagnóstico y recuperación. Importa el dominio y geometría física, nunca React, IndexedDB ni SVG. El adaptador de álgebra recibe matrices y vectores y se mantiene ajeno a nudos y barras. La capa de aplicación invoca el motor y traduce diagnósticos a estados de interfaz.
- Un Web Worker es una frontera prevista para modelos cuyo tiempo justifique aislar el cálculo. Comparte el contrato puro y trabaja con la revisión de la solicitud. La aplicación descarta resultados atrasados y nunca etiqueta un resultado como vigente después de una edición confirmada, Undo/Redo o un cambio de proyecto o caso. Las ediciones puramente visuales no invalidan resultados.
- El JSON v1 y los ejemplos actuales se conservan. Para guardar asignaciones en un incremento posterior, se propone una versión nueva y una migración v1 que conserva toda la geometría y deja las asignaciones pendientes. El documento semántico y su historial deberán tratar geometría y asignaciones como una transacción. Dividir hereda la asignación en ambos tramos, duplicar la remapea, invertir conserva la asignación y borrar elimina las referencias. Las pruebas de migración y edición deben preceder al uso de asignaciones persistentes.

## 3. Formulación matemática propuesta

### 3.1 Grados de libertad, orientación y signos

Orden global determinista por sufijo numérico del ID de nudo, con la secuencia `ux, uy, θz` de cada nudo. Se activa `θz` únicamente si el nudo participa en al menos un pórtico. No se añade una fila de giro nula a una armadura pura. Un Mz no nulo en un nudo sin giro activo se rechaza con ID de la carga. El bloqueo de giro de un empotramiento se considera inactivo en una armadura pura y se explica en la traza. Un nudo sin barras se diagnostica explícitamente. Se separan por ID los componentes desconectados, aunque coincidan en el plano.

| Cantidad | Convención |
| --- | --- |
| Traslación y fuerza global | +X hacia la derecha, +Y hacia arriba. |
| Giro y momento aplicado | +Z antihorario en el plano. El giro de pórtico es `dv/ds` en marco local. |
| Ejes de barra | +x del extremo i al j y +y a 90° antihorario de +x. |
| Fuerzas de extremo | `pₑ = kₑ dₑ − fₑ` son las acciones del nudo sobre el elemento, positivas en los ejes locales y con momento antihorario en ambos extremos. |
| Esfuerzo en una sección | Sobre la cara derecha del cuerpo situado a la izquierda del corte, N positivo actúa hacia +x (tracción), V positivo hacia −y y M positivo antihorario (flexión sagante). Por tanto, `V′ = qy` y `M′ = V` en intervalos regulares. Los signos de M interno y de los momentos de extremo se exponen por separado. |

Los campos se almacenan en SI. Las conversiones a mm, kN y kN·m pertenecen a la presentación. Las rotaciones nodales en resultados se almacenan en radianes. [Convenciones aprobadas y decisión pendiente sobre momentos internos, §§6.3–6.5](requisitos/DOCUMENTO_MAESTRO_2026-11-21.md)

### 3.2 Rigideces elementales, transformación y ensamblaje

Para armadura se retienen dos coordenadas axiales locales `[ui, uj]`. Si `c = Δx/L` y `sθ = Δy/L`, la proyección de `[uxi, uyi, uxj, uyj]` tiene filas `[c, sθ, 0, 0]` y `[0, 0, c, sθ]`. La matriz axial local es `(EA/L) · [[1,−1],[−1,1]]`. El ensamblaje se hace con su rigidez global de cuatro componentes. [Ecuaciones de armadura plana, MIT OpenCourseWare](https://ocw.mit.edu/courses/1-571-structural-analysis-and-control-spring-2004/321667e8ae36fcf7f130333299f516e0_connor_ch6.pdf)

Para pórtico, orden local `[ui, vi, θi, uj, vj, θj]`. Se coloca el bloque axial anterior en `[ui, uj]`. Sobre `[vi, θi, vj, θj]` se coloca el bloque de flexión y se dejan a cero los términos de acoplamiento axial–flexión.

```text
             [ 12     6L    −12     6L  ]
EI / L³  ×   [  6L    4L²   −6L     2L² ]
             [−12    −6L     12    −6L  ]
             [  6L    2L²   −6L     4L² ]
```

Para transformar desplazamientos globales a locales, cada bloque nodal de T tiene filas `[c,sθ,0]`, `[−sθ,c,0]`, `[0,0,1]`. Para ambos elementos se usa `dₑ = Tₑ Aₑ u`, con `Aₑ` como operador de extracción de índices globales. Conjugación por trabajo virtual `K ← K + Aₑᵀ Tₑᵀ kₑ Tₑ Aₑ` y `F ← F + Aₑᵀ Tₑᵀ fₑ`. Las cargas nodales globales elegidas se suman a F. Se preserva la simetría por almacenamiento y orden de ensamblaje reproducible. [Formulación de viga Euler–Bernoulli, TU Delft](https://teachbooks.tudelft.nl/computational-modelling/structural_linear/euler_bernouilli.html)

### 3.3 Restricciones de apoyo

Representar las restricciones homogéneas como `Cu=0` y construir una base Q del espacio permitido con bloques por nudo. En un rodillo con inclinación de superficie α, usar `n=(-sin α, cos α)` como fila de C y `t=(cos α, sin α)` como columna traslacional libre de Q. El giro permanece libre cuando existe. Articulaciones eliminan ambas traslaciones y empotramientos eliminan los grados activos del nudo. Cada columna conserva la combinación de grados originales en la traza. No fijar una componente global de un rodillo inclinado por aproximación ni usar penalizaciones artificiales.

```text
u = Q z
Kr = Qᵀ K Q,  fr = Qᵀ F
Kr z = fr
R = K u − F
```

Si todos los grados activos están restringidos, `u=0` y se calculan las reacciones sin factorizar una matriz vacía. Comprobar `QᵀR≈0` y que la reacción del rodillo sea paralela a n. El primer alcance adopta apoyos ideales bilaterales. Si una reacción apunta en sentido opuesto al normal elegido, reportar el signo. El contacto unilateral y los asentamientos requieren formulaciones posteriores.

### 3.4 Cargas nodales y equivalentes consistentes

Convertir cada vector global de barra al marco del elemento por rotación sin trasladar el origen. Conservar `s` en metros como referencia física. Para una fuerza puntual interior, evaluar `fₑ=N(s)ᵀP`. Para una distribución, integrar `fₑ=∫ N(s)ᵀq(s) ds` exclusivamente desde `s0` hasta `s1`. En pórtico, con `ξ=s/L`, usar interpolación axial `[1−ξ, ξ]` y las funciones transversales, en el orden `[vi,θi,vj,θj]`:

```text
[1−3ξ²+2ξ³, L(ξ−2ξ²+ξ³), 3ξ²−2ξ³, L(−ξ²+ξ³)]
```

Tres puntos de Gauss–Legendre en cada intervalo integran exactamente el producto de cúbica y carga lineal, de grado máximo cuatro, en aritmética exacta. En armadura, el equivalente axial usa la interpolación lineal de dos nudos. El primer incremento de armadura arranca con cargas nodales. La extensión admite componentes interiores axiales y rechaza las transversales porque el elemento carece de flexión. La comparación de paralelismo deberá usar tolerancia relativa a la magnitud de la carga, provisionalmente `1e−12`, para separar el redondeo de rotación de una carga transversal real. Una fuerza exactamente en `s=0` o `s=L` se contabiliza una vez como carga nodal global, conservando el ID y la barra propietaria en la traza. El motor no reescribe ni divide la barra por esta normalización. [Carga variacional y funciones de forma, TU Delft](https://teachbooks.tudelft.nl/computational-modelling/structural_linear/euler_bernouilli.html)

### 3.5 Estabilidad, solución y verificaciones

1. Validar propiedades, referencias, cargas admitidas y grados activos. Construir componentes por conectividad. Buscar movimientos rígidos candidatos por componente y grados sin rigidez. El conteo de restricciones o barras aporta diagnóstico, pero no demuestra por sí solo estabilidad.
2. Escalar simétricamente para poder comparar traslaciones y giros sin depender de una magnitud absoluta de rigidez. Con diagonales positivas, usar `Dii=1/√Kr,ii`, resolver `(D Kr D)y=D fr` y recuperar `z=D y`. Una diagonal no positiva se diagnostica antes de escalar. Usar una factorización de Cholesky y sustitución triangular para sistemas simétricos definidos positivos. Medir condicionamiento y residuo. No invertir matrices ni sumar rigidez ficticia. [Equilibrado, solución y estimación de condición en LAPACK DPOSVX](https://www.netlib.org/lapack/explore-html/d6/d44/group__posvx_gae23dac18e7ec69c36fd2a2648a470dc3.html)
3. Si Cholesky falla o la matriz está cerca de singularidad, diagnosticar mediante SVD o QR con pivoteo y tolerancia de rango validada. Separar, cuando haya evidencia, un movimiento rígido, un mecanismo interno y un sistema mal condicionado por escala física. Un modo casi nulo puede vincularse a los IDs mediante Q y D. Si es ambiguo, informar la sospecha y la condición, evitando una clasificación causal falsa. Ningún mecanismo se corrige con pseudoinversa ni se omite porque su fuerza conjugada sea cero.
4. Recuperar residuos y reacciones con el sistema sin reducir. Verificar equilibrio en X, Y y momento en Z usando cargas originales y momentos de brazo `rₓFy−rᵧFx` respecto de un origen cercano por componente. Integrar distribuciones en sus tramos físicos. Verificar también equilibrio de cada barra y residuo en grados libres. Usar suma compensada en los balances con cancelación intensa.

| Control | Umbral inicial propuesto y justificación |
| --- | --- |
| Geometría | Reusar `GEOMETRIC_TOLERANCE=10⁻⁸ m` para longitud válida heredada. La tolerancia de coincidencia del editor no decide rango ni fusiona nudos. |
| Asimetría escalada | `‖A−Aᵀ‖∞ ≤ 100 ε max(n,1) ‖A‖∞`, con `A=D Kr D`, n grados libres y ε de Float64. Un fallo significativo indica un problema de transformación o ensamblaje. |
| Rango numérico | Con SVD, `σ ≤ 10 ε max(n,1) σmax` marca dirección numéricamente nula. Validar el multiplicador con casos cercanos a mecanismo y contrastarlo con la estimación de condición. |
| Condición | Usar `rcond` estimado en norma 1 para la matriz escalada. Advertir para `1e−12 ≤ rcond < 1e−8`. Por debajo de `1e−12`, devolver solo el diagnóstico incluso si el residuo es pequeño. Calibrar los umbrales con los casos de referencia. |
| Error de solución | Residuo hacia atrás escalado `‖Ay−b‖∞/(‖A‖∞‖y‖∞+‖b‖∞) ≤ 1e−10`, con `b=D fr`. Si ambos son cero, el control solo pasa si el numerador es cero. |
| Compatibilidad | Cada entrada de `Cu` dentro de `1e−11 + 1e−10 Uref` en m o rad. `Uref` usa el mayor valor absoluto de su clase, traslación o giro. |
| Equilibrio | Por componente y momento, `abs(residuo) ≤ 1e−6 + 1e−8 S` en N o N·m, con S como suma de magnitudes de contribuciones de carga y reacción de esa clase. Chequear por separado reacciones en grados libres en unidades coherentes. |

Estas tolerancias separan error geométrico, redondeo y aceptación del resultado. Deben mantenerse configurables para pruebas, versionarse con el resultado y calibrarse con los casos de referencia y modelos de escala dispar.

### 3.6 Recuperación de campos internos

Calcular fuerzas de extremo por elemento mediante `pₑ` y reconstruir N, V y M desde equilibrio de cortes con las cargas originales. Con fuerzas de extremo locales iniciales `p_ix, p_iy, m_i`, en la sección s y con ξ como estación en metros:

```text
N(s) = −p_ix − Σ P_x(ξ ≤ s) − ∫₀ˢ qx(ξ) dξ
V(s) =  p_iy + Σ P_y(ξ ≤ s) + ∫₀ˢ qy(ξ) dξ
M(s) = s p_iy − m_i + Σ (s−ξ) P_y(ξ ≤ s) + ∫₀ˢ (s−ξ) qy(ξ) dξ
```

Registrar estaciones a ambos lados de cargas puntuales para que los saltos no se suavicen. Reconstruir desplazamientos de sección a partir de `u′=N/(EA)` y `v″=M/(EI)`, con condiciones del extremo, en elementos prismáticos. Comprobar los valores recuperados contra los grados del extremo opuesto. La interpolación cúbica simple de los grados nodales no recupera por sí sola una flecha interior exacta dentro de un tramo cargado. La implementación debe separar la solución nodal de esa recuperación interior y validar ambas.

## 4. Salida educativa y trazabilidad

| Salida | Datos e identidad |
| --- | --- |
| `summary` | Conteos activos y libres, estado, reacciones, desplazamientos, esfuerzos de extremo y balances. Cada valor numérico conserva unidad, signo y el ID del nudo o barra. |
| `members` | Transformaciones, rigideces locales, vectores equivalentes por carga, acciones de extremo y resultados de sección con `barId`, estación física y lado del salto. |
| `constraints` | Filas de C, normal y tangente, grados retirados o combinados y aportes a reacciones. Las referencias usan `nodeId`. |
| `trace` opcional | Orden de grados, aportes elementales y referencias, K y F ensamblados, restricciones, sistema reducido y escalado, solución, recuperación y balance. Para modelos grandes, entregar bloques o contribuciones por demanda y evitar duplicar varias matrices densas. |
| `diagnostics` | Código, gravedad, etapa, IDs afectados, medidas de condición y, si procede, modo de desplazamiento aproximado vinculado a los nudos. |

**Resolver** consume el resultado resumido con acceso al detalle. **Aprender** utiliza los mismos valores y puede enlazar una ecuación, una fila de matriz o una contribución de carga con su nudo, barra o tramo. Los pasos se emiten como datos estructurados y versionados. El formato pedagógico y el marcado visual quedan en la interfaz. El primer motor proporciona este contrato para futuros modos sin cambiar el selector preliminar actual.

## 5. Matriz de pruebas de referencia

Entradas comunes. E = 200 GPa, A = 10⁻³ m² e I = 8×10⁻⁶ m⁴ donde aplique, salvo excepciones indicadas. En vigas horizontales el apoyo simple izquierdo es articulado y el derecho es un rodillo con superficie horizontal. (R) es la acción del apoyo sobre la estructura. Los desplazamientos se dan en m, giros en rad, fuerzas en N y momentos en N·m. Los oráculos usan equilibrio, leyes de barra, integración de viga, trabajo virtual o ecuaciones de pendiente–deflexión. Se calcularon los valores numéricos con esas fórmulas, de forma independiente del futuro motor.

| Caso y entrada reproducible | Resultados esperados | Oráculo y tolerancia |
| --- | --- | --- |
| **Axial**. A=(0,0) articulado, B=(2,0) rodillo horizontal. Barra de armadura AB. Fx(B)=+10 000 N. | `uxB=+1e−4`, `uyB=0`, N=+10 000, `RxA=−10 000`, `RyB=0`. | Equilibrio y PL/(EA). T1. |
| **Armadura triangular**. A=(0,0) articulado, B=(4,0) rodillo horizontal, C=(2,3). Barras AB, AC y BC de armadura. Fy(C)=−12 000 N. | `RyA=RyB=6000`, `RxA=0`. N(AB)=+4000, N(AC)=N(BC)=−7211,10255093. `uyC=−1,82907221937e−4`. | Método de nudos y trabajo virtual con carga unitaria. T1. |
| **Viga con puntual**. AB de pórtico, A=(0,0), B=(6,0), apoyos simples. Fy=−12 000 N a s=3 m sobre la barra. | `RyA=RyB=6000`, `θA=−0,016875`, `θB=+0,016875`, `v(3)=−0,03375`, `M(3)=+18 000`, `V(3⁻)=+6000`, `V(3⁺)=−6000`. | Equilibrio e integración de M/(EI) por tramos. T1 y T2 para secciones. |
| **Viga con distribuida**. AB de pórtico, A=(0,0), B=(4,0), apoyos simples. qy=−5000 N/m sobre [0,4] m. | `RyA=RyB=10 000`, `θA=−0,008333333333`, `θB=+0,008333333333`, `v(2)=−0,010416666667`, `M(2)=+10 000`. | Integración de carga, equilibrio y curva de Euler–Bernoulli. T1 y T2 para secciones. |
| **Voladizo**. A=(0,0) empotrado, B=(3,0) libre. Barra de pórtico, I=10⁻⁵ m⁴. Fy(B)=−8000 N. | `uyB=−0,036`, `θB=−0,018`, `RyA=+8000`, `MzA=+24 000`, `M(0⁺)=−24 000`. | Equilibrio, PL³/(3EI) y PL²/(2EI). T1. |
| **Pórtico simple**. A=(0,0), B=(0,2), C=(2,2), D=(2,0). A y D empotrados. Barras A→B, B→C y D→C. A de sección = 0,02 m² e I=2×10⁻⁵ m⁴ en todas. Fx(B)=Fx(C)=+10 000 N. | `uxB=uxC=2,38462270435e−3`, `uyB=+4,28204396232e−6`, `uyC=−uyB`, `θB=θC=−7,17956037682e−4`. `RxA=RxD=−10 000`, `RyA=−8564,08792464`, `RyD=−RyA`, `MzA=MzD=+11435,91207536`. | Simetría y pendiente–deflexión con axial de columnas. Sistema independiente indicado abajo. T1. |
| **Rodillo inclinado**. Barra de armadura AB horizontal de 2 m. A articulado y B rodillo de superficie α=45°. Fy(B)=−10 000 N. | `uxB=uyB=−1e−4`, N=−10 000, `RA=(+10 000,0)`, `RB=(−10 000,+10 000)`. Se cumple `n·uB=0` y `t·RB=0`. | Equilibrio global, ley axial y compatibilidad del apoyo. T1. |
| **Mecanismo**. Misma geometría axial horizontal, A articulado y B sin apoyo. Ejecutar con Fy(B)=−1000 N y sin cargas. | Rechazo por grado transversal `uyB` libre de rigidez en ambos ensayos. El modo candidato puede representarse con `uyB=1`. El resultado ordinario queda indisponible. | Rango analítico del sistema reducido `diag(EA/L,0)`. T3. |

**T1** · Aceptación de cada valor `abs(obtenido−esperado) ≤ atol + 1e−8·abs(esperado)`. Usar `atol=1e−10` m o rad, `1e−5` N y `1e−5` N·m. **T2** · para desplazamientos de sección usar `atol=1e−9 m` y `rtol=1e−7`, con las mismas comprobaciones de fuerzas y momentos de T1. **T3** · comprobar código de inestabilidad, ID de nudo/grado diagnosticado y ausencia de resultado ordinario. Cada caso estable pasa además los balances de la sección 3.5.

Para reproducir el pórtico de forma independiente, por antisimetría `uxB=uxC=u`, `uyB=−uyC=v` y `θB=θC=θ`. La compatibilidad axial de columnas y las ecuaciones de pendiente–deflexión conducen a este sistema, en SI, con la fuerza H = 10 000 N aplicada en cada nudo superior:

```text
[6e6     0         6e6 ] [u]     [H]
[0       2.012e9   12e6] [v]  =  [0]
[6e6     12e6      20e6] [θ]     [0]

RxA = RxD = −H,  RyA = −(EA/h) v,  RyD = −RyA
MzA = MzD = (6EI/h²)u + (2EI/h)θ,  con h=2 m
```

Además de la matriz de referencia, añadir pruebas de invariantes. Incluir traslación del origen y giro rígido del caso completo, permutación de arrays, inversión de barra con transformación local, cargas justo en los extremos, distribución lineal parcial con componentes axial y transversal, suma de cargas por ID y verificación de su resultante y primer momento. Probar componentes desconectados, superposiciones sin soldadura, apoyo orientado cerca de un mecanismo, condición extrema, ausencia de E/A/I y reconstrucción de trazas. Los resultados del editor recuperado desde JSON deben ser equivalentes al analizar la misma definición.

## 6. Plan incremental y puerta de aceptación

| Incremento propuesto | Dependencias y salida verificable |
| --- | --- |
| **4.1 Contratos y preparación** | Definición mecánica por barra, validación de entrada y convenciones aprobadas. Fixtures independientes, mapa de IDs/grados y definición de diagnósticos. Sin modificar persistencia hasta tener prueba de migración. |
| **4.2 Armadura y núcleo numérico** | Sobre 4.1, ensamblaje axial, restricciones exactas, solución con Cholesky, rango y balances. Pasan los oráculos axial, triangular, rodillo inclinado e inestable. |
| **4.3 Pórtico y acciones consistentes** | Sobre 4.2, matriz EI, vectores puntuales y distribuidos, recuperación nodal y de secciones. Pasan vigas, voladizo y pórtico, más transformaciones e invariantes. |
| **4.4 Integración y traza** | Consumo de una instantánea confirmada desde la aplicación, estados de diagnóstico, traza por ID, navegación entre resultados y modelo y, si corresponde, ejecución en Worker. |
| **4.5 Edición y persistencia de propiedades** | Contrato consolidado, migración versionada, Undo/Redo de asignaciones y conservación al duplicar, dividir, invertir o eliminar. Regresión de importación, recarga y exportación. |

La puerta de aceptación exige los ocho oráculos independientes, residuo y equilibrio dentro de tolerancia, rechazo explícito de matrices singulares y datos incompletos, trazabilidad de resultados y ausencia de regresiones CAD y de persistencia. Se deben ejecutar Vitest, Playwright, TypeScript y producción tras cada integración. Para exponer el motor a estudiantes, verificar también qué ocurre cuando se edita durante el cálculo y cuando se cambia de proyecto. Las futuras APIs de análisis mantendrán resultados anteriores como históricos u obsoletos con su revisión visible.

## 7. Decisiones pendientes y riesgos

- **Alcance normativo del modelo.** Aprobar la convención N/V/M interna antes de fijar diagramas y ejemplos de curso. El documento maestro distingue este signo de los momentos nodales aplicados. Pórticos iniciales con uniones rígidas y sin liberaciones. Una rótula de apoyo no implica liberación de giro entre barras del mismo nudo. Deformación por cortante, efectos de segundo orden, contacto unilateral y asentamientos requieren alcance separado.
- **Propiedades y documento.** Aprobar el esquema futuro y el lugar de edición de E, A e I. Un JSON v1 migrado se abre con su geometría, pero necesita asignaciones para analizar. El uso de perfiles o materiales de catálogo, las combinaciones de carga y peso propio aún carecen de datos en el editor.
- **Solución numérica.** Cholesky es apropiado tras restricciones y con rigidez positiva. Seleccionar y verificar el backend Float64 y la estrategia de diagnóstico de rango al implementar. Un sistema muy condicionado puede pasar el equilibrio y seguir ofreciendo desplazamientos poco fiables. Los umbrales y el tamaño máximo denso deben calibrarse antes de decidir cuándo cambiar a matrices dispersas o ejecutar en Worker.
- **Contradicciones de entrada detectables.** Cargas transversales interiores sobre armaduras y momentos en un nudo sin grado de giro requieren diagnóstico. Nudos superpuestos, barras cruzadas, estructuras desconectadas y mecanismos se analizan según sus IDs y restricciones. Los resultados de equilibrio no sustituyen la verificación del modelo físico elegido.
- **Integración académica.** Priorizar una solución de rigidez trazable. Trabajos virtuales, líneas de influencia, método de las fuerzas y distribución de momentos se implementarán por etapas independientes sobre contratos comunes, después de validar esta base.
