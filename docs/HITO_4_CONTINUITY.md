# Hito 4.1 + 4.2 · Núcleo matemático de armaduras 2D

El núcleo resuelve armaduras planas elásticas y lineales con fuerzas nodales y apoyos ideales. Su entrada usa una instantánea de `Structure` y asignaciones mecánicas explícitas. La implementación vive en `src/analysis/` y conserva los contratos CAD y JSON v1. [Arquitectura aprobada](HITO_4_ANALYSIS_ARCHITECTURE.md)

## Contratos implementados

| Contrato | Uso |
| --- | --- |
| `AnalysisDefinition` | Versión 1 y una asignación `truss2d` por barra, por `barId`, con E en Pa y A en m², positivos y finitos. También se valida que EA/L sea representable. |
| `AnalysisCase` | ID del caso y, opcionalmente, IDs explícitos de carga. Si se omiten, se incluyen todas las cargas. Un caso vacío sirve para verificar la estabilidad sin fuerza aplicada. |
| `AnalysisInput` | Modelo, definición, caso, revisión opcional y opción de traza. Se entrega a `solveTruss` desde código TypeScript. |
| `PreparedModel` | Nudos y barras validados, conectividad por ID, apoyos, fuerzas nodales y mapa reversible entre nudo y grados. `prepareTruss` también está disponible para validación sin cálculo. |
| `AnalysisResult` | Éxito con desplazamientos, reacciones, alargamiento o acortamiento, fuerza axial, balances y traza opcional. En caso de fallo solo contiene diagnósticos y procedencia. |
| `AnalysisDiagnostic` | Código, severidad, mensaje e IDs de entidades afectadas. Si existe una coordenada que evidencia el problema numérico, se identifica la dirección original. |

El orden es `[ux, uy]` por nudo, con el sufijo numérico de los IDs del editor como orden primario. Cada resultado identifica el caso, la revisión si se proporcionó y la versión del núcleo, `4.2.0`. La traza contiene las rigideces por barra, `K` y `F`, y para cada componente incluye `Q`, `Kr`, `Fr`, el escalado y `z`. Las matrices son `Float64Array` por filas. Se conservan `barId`, IDs de cargas y propietarios originales. [API](../src/analysis/index.ts) · [Contratos](../src/analysis/contracts.ts)

## Formulación y solución

1. Validar coordenadas, extremos, longitudes y duplicados. Separar componentes por conectividad de IDs. Los cruces y coincidencias geométricas no añaden vínculos. Los nudos aislados se diagnostican antes de ensamblar.
2. Para cada barra, con `e=[−c,−s,c,s]` y `[c,s]=(B−A)/L`, ensamblar `k=(EA/L)e eᵀ`. Las orientaciones se calculan a partir de las coordenadas físicas. El vector global suma las cargas por nudo mediante suma compensada.
3. Construir la base `Q`. Articulado y empotrado restringen ambas traslaciones. El empotramiento informa que el giro está inactivo. Para un rodillo de superficie α, `n=(−sin α,cos α)` y `t=(cos α,sin α)`. La columna libre es `t`. En orientaciones cardinales exactas se representa el cero exacto para evitar una rigidez espuria. Las orientaciones oblicuas conservan su precisión.
4. Ensamblar `Kr=QᵀKQ` mediante las extensiones axiales proyectadas y `Fr=QᵀF`. Esta forma evita cancelar grandes términos cuando una dirección es casi perpendicular a las barras. El sistema se resuelve por componentes. Cada bloque usa escalado simétrico `Dii=1/√Kr,ii`, Cholesky y sustitución triangular. Una componente completamente restringida tiene desplazamiento cero y reacciones por equilibrio.
5. Recuperar `u=Qz`, `R=Ku−F`, `δ=(B−A)/L · (uB−uA)` y `N=(EA/L)δ`. Desplazamientos y elongación están en m y las fuerzas en N. Tracción es positiva. Se comprueban fuerzas y momentos respecto al primer nudo de la componente, residuo reducido, compatibilidad y reacción tangencial de cada rodillo.

Los controles numéricos usan un pivote mínimo proporcional a `10 ε n ‖D Kr D‖∞`, residuo hacia atrás escalado ≤ `1e−10` y estimación de condición recíproca en norma 1. Por debajo de `1e−8` se advierte y por debajo de `1e−12` se rechaza. También se rechaza una dirección cuya rigidez diagonal es inferior a `1e−12` de la rigidez axial incidente en el nudo. El balance usa tolerancia absoluta de `1e−6` N o N·m más `1e−8` por la escala de contribuciones. Para cada rodillo se verifica la componente tangencial con la magnitud de su propia reacción como escala. La compatibilidad usa `1e−11 m + 1e−10·Uref`.

La primera ejecución específica detectó un cero con signo negativo en la traza del rodillo horizontal. Se normalizó a cero exacto. Se añadió una prueba cuya dirección débil es ortogonal al vector uniforme de la estimación de condición. La estimación incorpora un vector alternante para detectar ese caso de cancelación. Los ensayos conservan las tolerancias analíticas aprobadas.

## Resultados de los casos obligatorios

Los resultados siguientes se verificaron con los oráculos de equilibrio, ley axial y trabajo virtual indicados en la arquitectura. T1 compara con `atol + 1e−8·|referencia|`, con `atol=1e−10 m` y `1e−5 N`. T3 exige un diagnóstico y la ausencia de resultados ordinarios.

| Caso | Valores comprobados | Resultado |
| --- | --- | --- |
| A · Barra axial | `uB=(0,0001,0) m`, elongación `+0,0001 m`, `N=+10 000 N`, `RA=(−10 000,0) N`. | Aprobado, T1. |
| B · Armadura triangular | `RyA=RyB=6000 N`, `NAB=+4000 N`, `NAC=NBC=−7211,10255093 N`, `uyC=−0,000182907221937 m`. | Aprobado, T1. |
| C · Rodillo inclinado | `uB=(−0,0001,−0,0001) m`, `N=−10 000 N`, `RA=(+10 000,0) N`, `RB=(−10 000,+10 000) N`. | Aprobado, T1. |
| D · Mecanismo | `N2.uy` queda libre y sin rigidez. Se rechazó tanto con carga transversal como sin carga. | Aprobado, T3. |

## Matriz de aceptación

| Requisito | Evidencia | Estado |
| --- | --- | --- |
| Contratos y E/A válidos | Rechazo de propiedades ausentes, no finitas, nulas y negativas y de geometrías sin extremos o longitud. | Conforme |
| Dofs e identidad reproducibles | Permutaciones, orden numérico, cruces y dos componentes con nudos coincidentes. | Conforme |
| Rigidez elemental y ensamblaje | Matriz analítica 3–4–5, simetría, inversión de barra y superposición compensada de fuerzas. | Conforme |
| Restricciones inclinadas | El rodillo a 45° satisface desplazamientos, normal de reacción, `Q`, `Kr` y `Fr` analíticos. Un rodillo a 90° no fabrica rigidez. | Conforme |
| Cholesky y control de estabilidad | Sin solución en los mecanismos cartesiano y oblicuo. Aviso y rechazo por condicionamiento en un sistema de referencia. | Conforme para 4.2 |
| Reacciones, axiales y balances | Casos A–C, giro y traslación rígidos, reacción del modelo sin grados libres y controles de momentos y compatibilidad. | Conforme |
| Límite de cargas | Se rechazan momentos no nulos y cargas puntuales y distribuidas en barras, con sus IDs. | Conforme |
| Aislamiento del CAD | El motor no se importa desde el editor ni desde la aplicación. Las pruebas existentes permanecen intactas. | Conforme |

## Archivos

- [Contratos](../src/analysis/contracts.ts), [preparación](../src/analysis/prepare.ts) y [API pública](../src/analysis/index.ts).
- [Rigidez y ensamblaje](../src/analysis/truss.ts), [álgebra lineal](../src/analysis/linear.ts), [solución](../src/analysis/solve.ts) y [recuperación](../src/analysis/recover.ts).
- [Pruebas analíticas y de invariantes](../src/analysis/truss.test.ts) y este informe.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| Vitest específico | 23 pruebas aprobadas del motor. |
| Vitest completo | 117 pruebas aprobadas en 15 archivos. |
| TypeScript | `tsc --noEmit` finalizó sin errores. |
| Compilación | `vite build` finalizó correctamente. |
| Playwright de regresión | 35 pruebas aprobadas en Edge para Windows sobre la compilación local. |

Las verificaciones se realizaron con Node.js 24.22.1. El commit local incluye el núcleo, sus pruebas y este informe. Los cambios previos de otros hitos permanecen fuera de ese commit.

## Límites y siguiente incremento

- El núcleo es denso y limita la entrada a 1024 grados activos. La estimación de condición es un indicador, no un cálculo completo de rango. El diagnóstico registra la coordenada o el pivote que reveló el problema. La causa global y las formas de mecanismos acoplados requieren SVD o QR con pivoteo.
- Se admiten fuerzas nodales. Las cargas sobre barras, incluso una puntual en su extremo, se rechazan en 4.2 cuando pertenecen al caso. La normalización de extremos y las cargas equivalentes se reservan para el incremento siguiente. Las restricciones son ideales y bilaterales.
- El CAD, las unidades, el historial y el esquema JSON v1 conservan su implementación. Las propiedades mecánicas se proporcionan en memoria y no tienen un control de interfaz. Los resultados todavía no se exponen en la aplicación.

**Siguiente instrucción propuesta:** implementar 4.3 con un tipo separado para pórticos Euler–Bernoulli, activación de giro por incidencia, I positiva y finita, cargas equivalentes consistentes y recuperación de esfuerzos por sección. Mantener las pruebas de armadura y validar las dos vigas, el voladizo y el pórtico de la arquitectura antes de introducir diagramas o persistencia de propiedades.
