# Hito 4.3 · Motor de vigas y pórticos 2D

## Contrato

`solveAnalysis(input)` resuelve armaduras, pórticos y modelos mixtos. `prepareAnalysis(input)` permite consultar la validación, los grados activos y los componentes conectados sin resolver. La definición mecánica versión 1 asigna un elemento a cada ID de barra. `truss2d` requiere E en Pa y A en m². `frame2d` requiere además I en m⁴ respecto de Z local. E, A e I deben ser finitos y estrictamente positivos. También se comprueba que las rigideces se puedan representar en Float64.

El motor consume el `Structure` existente como instantánea de solo lectura. Las propiedades mecánicas forman parte de `AnalysisDefinition` y se entregan con la solicitud de análisis. Se conservan el ID del caso, la revisión aportada y los IDs de nudos, barras y cargas. Si se especifica `loadIds`, el motor analiza únicamente ese conjunto. La conectividad se deduce de los IDs de nudo en los extremos.

El orden global es determinista por ID de nudo. La secuencia por nudo es `ux, uy` y se añade `rz` cuando incide al menos un pórtico. Los pórticos que comparten nudo comparten el giro. Las armaduras solo participan en las dos traslaciones de cada extremo. Un momento distinto de cero en un nudo sin giro activo produce `INACTIVE_ROTATION`.

La salida ordinaria incluye reacciones de apoyo, desplazamientos por nudo y resultados por barra. `rotation` está en radianes y aparece en los nudos con giro activo. `moment` está en N·m y aparece en la reacción de los empotramientos con giro activo. Una barra de armadura conserva su fuerza axial y alargamiento. Una barra de pórtico añade `localDisplacements`, `endForces`, `equivalentLocal`, cargas interiores y estaciones de sección. En pórticos, `axialForce` corresponde a (N(0⁺)). Los fallos devuelven diagnósticos con los IDs disponibles.

Con `includeTrace`, el resultado expone K y F globales, matrices elementales, K local, T y fuerzas equivalentes de pórtico. Por componente conserva Q, Kr, Fr, escalado y solución reducida. `solveTruss` y `prepareTruss` se mantienen como entradas estrictas para armaduras con fuerzas nodales. Los balances añaden residuos de momentos y de compatibilidad de giro, y las cargas preparadas identifican su tipo.

## Rigidez y transformación

Se aplica elasticidad lineal, pequeñas deformaciones, secciones prismáticas y la hipótesis de Euler–Bernoulli. El orden local es `[ui, vi, θi, uj, vj, θj]`. Sean (a=EA/L), (b=12EI/L³), (d=6EI/L²), (e=4EI/L) y (f=2EI/L).

```text
    [  a   0   0  −a   0   0 ]
    [  0   b   d   0  −b   d ]
k = [  0   d   e   0  −d   f ]
    [ −a   0   0   a   0   0 ]
    [  0  −b  −d   0   b  −d ]
    [  0   d   f   0  −d   e ]
```

El bloque axial y los términos traslación–traslación en flexión están en N/m. Los acoplamientos traslación–giro están en N y los términos giro–giro en N·m, con el radián como adimensional. Para (c=ΔX/L), (sθ=ΔY/L), cada bloque nodal de T tiene filas `[c,sθ,0]`, `[−sθ,c,0]` y `[0,0,1]`. Se aplica `dlocal = T dglobal`, `Kglobal = Tᵀ k T` y `Fglobal = Tᵀ flocal`.

El ensamblaje global y reducido usa sumas de productos exteriores para conservar la simetría. Los modos de pórtico son extensión `uj−ui`, flexión simétrica `θi+θj−2(vj−vi)/L` y diferencia `θi−θj`, con rigideces EA/L, 3EI/L y EI/L. Proyectar esos modos sobre Q antes de multiplicar evita obtener rigideces débiles por diferencia de términos grandes.

## Cargas consistentes

Las fuerzas y los momentos nodales se suman en sus grados activos. Las cargas de barra se transforman al marco local mediante rotación de sus vectores. Se mantienen (s), (s₀) y (s₁) en metros medidos desde el extremo inicial. Para (ξ=s/L), las funciones axiales son `[1−ξ, ξ]` y las de flexión para `[vi, θi, vj, θj]` son:

```text
[1−3ξ²+2ξ³, L(ξ−2ξ²+ξ³), 3ξ²−2ξ³, L(−ξ²+ξ³)]
```

La fuerza puntual equivale a `fₑ=N(s)ᵀ P`. Un punto exactamente en 0 o L se convierte una sola vez en acción nodal global, conservando el ID y la barra propietaria. Las cargas de barra interiores se conservan para la recuperación de sección. Para distribuciones uniformes o lineales se integra `N(s)ᵀ q(s)` en `[s₀,s₁]` con Gauss–Legendre de tres puntos. El integrando tiene grado máximo cuatro. Esta operación conserva resultante, primer momento, trabajo virtual y efectos de extremo. La API mixta rechaza cargas interiores sobre armaduras, incluidas las axiales. Su posible extensión queda pendiente.

## Restricciones y controles numéricos

Se comparte la misma base Q, reducción, resolución escalada y Cholesky para ambos tipos de elemento. La articulación bloquea las traslaciones. El empotramiento bloquea todos los grados activos. Para el rodillo con superficie de ángulo global α, solo se admite la traslación tangencial `(cos α, sin α)` y se conserva el giro cuando existe. El apoyo es bilateral e ideal.

Se resuelve `Qᵀ K Q z = Qᵀ F` con escalado simétrico y sustituciones triangulares. Las reacciones se obtienen de `K u − F` con `u=Qz`. Se comprueban el residuo libre de fuerza y de momento por separado, la compatibilidad y la reacción tangencial de rodillos, además del equilibrio global de cada componente. El balance de cargas distribuidas usa sus resultantes y primeros momentos analíticos a partir de las intensidades físicas y sus estaciones. El origen del balance de momentos es un nudo del componente.

- Equilibrio en N y N·m. Límite `1e−6 + 1e−8 S`, con una escala S de la magnitud correspondiente. Compatibilidad en m y rad. Límite `1e−11 + 1e−10 Uref` por familia de grados.
- Se conserva el aviso de condición para `1e−12 ≤ rcond < 1e−8` y el rechazo por debajo de `1e−12`. El error hacia atrás se limita a `1e−10`. En nudos de armadura se conserva el control local contra rigidez axial incidente. En nudos con pórtico se escala por la diagonal propia para respetar la diferencia física entre rigideces axiales y flexionales.
- El pivote de Cholesky se comprueba con `10 ε n ‖D Kr D‖∞`. Los diagnósticos identifican componentes y, cuando el fallo señala una coordenada, su nudo y grado. La clasificación modal mediante QR/SVD permanece pendiente.

## Recuperación de esfuerzos y desplazamientos

`p = k dlocal − fₑ` son las acciones de los nudos sobre la barra, ordenadas como `[p_ix, p_iy, m_i, p_jx, p_jy, m_j]`. Los momentos de extremo son positivos antihorarios. En la cara derecha del tramo izquierdo de un corte, N positivo actúa hacia +x, V positivo hacia −y y M antihorario es sagante positivo. Así, (V′=q_y), (M′=V) y (N′=-q_x) en los tramos regulares. El momento de reacción del empotramiento y (M(0⁺)) pueden tener signos opuestos, como se comprueba en el caso G.

Para describir la integración, `Jk(g)` representa la suma de `(s−ξ)^k P_g` de fuerzas interiores hasta el corte y la integral de `(s−ξ)^k q_g(ξ)` sobre los intervalos cargados que queden a su izquierda. En una discontinuidad, `side` decide si se incluye la fuerza puntual situada justo en s.

```text
N = −p_ix − J0(x)
V =  p_iy + J0(y)
M =  s p_iy − m_i + J1(y)
u =  ui − (p_ix s + J1(x)) / EA
θ =  θi + (p_iy s²/2 − m_i s + J2(y)/2) / EI
v =  vi + θi s + (p_iy s³/6 − m_i s²/2 + J3(y)/6) / EI
```

Las expresiones integran (u′=N/(EA)), (θ=v′) y (θ′=M/(EI)) con las condiciones iniciales nodales. Gauss de tres puntos integra también el mayor grado de los términos interiores, que es cuatro. Se verifican las fuerzas de cara `[p_jx, −p_jy, m_j]` y los desplazamientos `[uj,vj,θj]` en L. Los controles del extremo usan tolerancia absoluta de `1e−6` en N o N·m y `1e−10` en m o rad, más `1e−8` relativo a la escala de la magnitud.

`evaluateFrameSection(bar, s, side?)` evalúa una estación física en `[0,L]`. El lado por defecto es derecho en el interior e izquierdo en L. Una estación inválida o un resultado fuera del rango de Float64 produce `RangeError`. Las estaciones generadas incluyen los extremos, los límites de los tramos distribuidos y ambos lados de los puntos interiores. Una fuerza puntual puede provocar saltos en N y V. M, u, v y θ conservan continuidad. La búsqueda automática de extremos de los campos queda para un incremento posterior.

## Resultados de referencia

Las cifras son las referencias externas al motor fijadas en la arquitectura. Cada comparación pasó dentro de T1 o T2. T1 usa `atol + 1e−8·|esperado|` con `atol=1e−10` m o rad y `1e−5` N o N·m. T2 usa `1e−9 m + 1e−7·|esperado|` para flechas de sección. Todos los casos estables pasan además el balance.

| Caso | Valores comprobados | Referencia |
| --- | --- | --- |
| E · Viga de 6 m, central de −12 000 N | Ry = 6000 N en ambos apoyos. θA = −0,016875 rad, θB = +0,016875 rad. v(3) = −0,03375 m, M(3) = +18 000 N·m, V(3⁻) = +6000 N y V(3⁺) = −6000 N. | Equilibrio y flecha `−PL³/(48EI)`. |
| F · Viga de 4 m, −5000 N/m | Ry = 10 000 N en ambos apoyos. θA = −0,008333333333 rad, θB = +0,008333333333 rad. v(2) = −0,010416666667 m, M(2) = +10 000 N·m. | Curva cuártica de Euler–Bernoulli, flecha `−5qL⁴/(384EI)` con q como magnitud. |
| G · Voladizo de 3 m, −8000 N en B | uyB = −0,036 m, θB = −0,018 rad. RyA = +8000 N, MzA = +24 000 N·m, M(0⁺) = −24 000 N·m. | Equilibrio y fórmulas `−PL³/(3EI)`, `−PL²/(2EI)`. |
| H · Pórtico cuadrado de 2 m, 10 000 N en +X en B y C | uxB = uxC = 2,38462270435×10⁻³ m. uyB = +4,28204396232×10⁻⁶ m y uyC = −uyB. θB = θC = −7,17956037682×10⁻⁴ rad. RxA = RxD = −10 000 N. RyA = −8564,08792464 N y RyD = −RyA. MzA = MzD = +11435,91207536 N·m. | Sistema independiente de pendiente–deflexión con deformación axial de columnas de la arquitectura. |
| A–D · Regresión de armaduras | Barra axial, armadura triangular y rodillo inclinado coinciden con las referencias originales. Los dos escenarios del caso inestable se rechazan, con y sin carga. | Ley axial, método de nudos, trabajo virtual, equilibrio y prueba de mecanismo. |

## Matriz de aceptación

| Requisito | Evidencia | Estado |
| --- | --- | --- |
| Pórtico horizontal, vertical e inclinado | Simetría, coeficientes de matriz, (Tᵀ k T) y energía para 0°, 90° y 3–4–5. | Conforme |
| Pórticos y armaduras en el mismo modelo | Fuerza axial en serie, índices de grados, rotación compartida en el caso H y rechazo de Mz en nudo de solo armadura. | Conforme |
| Rodillo inclinado | Desplazamiento tangente compatible, reacción normal, giro libre y equilibrio. | Conforme |
| Fuerza puntual oblicua e intervalo de aplicación | Trabajo virtual, transformación global/local, saltos de N y V, continuidad de M y equivalencia nodal en ambos extremos. | Conforme |
| Distribuciones parciales uniformes, triangulares y trapezoidales | Los seis términos equivalentes se comparan con antiderivadas. Se comprueban resultantes, primeros momentos y flecha de sección bajo carga axial y transversal simultáneas. | Conforme |
| Superposición e inversión | Fuerzas y pares simultáneos, cancelación de fuerzas superpuestas, inversión de barra inclinada con cargas locales y globales. | Conforme |
| Equilibrio, secciones y flechas | Casos E a H, equilibrio global por componente, comprobación de condiciones de extremo y relación (M′=V). | Conforme |
| Validación e inestabilidad | I ausente, inválida o desbordada, mecanismo de cuerpo rígido y rechazo explícito de cargas interiores de armadura. | Conforme |
| Regresión matemática, CAD y persistencia | Suites Vitest y Playwright, TypeScript estricto y compilación de producción. | Conforme |

## Verificación y archivos

| Control | Línea base | Resultado del incremento |
| --- | --- | --- |
| Vitest | 117 pruebas | 134 aprobadas. Incluye 23 de armaduras y 17 nuevas de pórtico. |
| Playwright, Edge | 35 pruebas | 35 aprobadas. Incluye CAD, historial, importación y persistencia. |
| TypeScript | Aprobado | Aprobado con `tsc --noEmit`. |
| Vite, producción | Aprobado | Compilación aprobada. |

- `src/analysis/contracts.ts`, `index.ts` y `prepare.ts` amplían el contrato público y la preparación.
- `src/analysis/frame.ts` contiene formulación, cargas equivalentes y recuperación de sección.
- `src/analysis/assembly.ts` sustituye a `truss.ts` como módulo común de ensamblaje y reducción. `summation.ts` comparte la suma compensada.
- `src/analysis/solve.ts` y `recover.ts` enlazan la resolución, los balances y la traza.
- `src/analysis/frame.test.ts` incorpora los oráculos e invariantes del incremento.

El límite heredado es de 1024 grados activos para matrices densas. La generación de estaciones revisa las cargas de cada barra por estación. La escala y la estimación de condición siguen las reglas de 4.2. La distinción detallada entre mecanismos, el análisis de segundo orden, la deformación por cortante, las rótulas, los asentamientos, los diagramas, la interfaz de resultados y la persistencia de E, A e I quedan fuera de este incremento.
