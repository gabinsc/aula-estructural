# Rótulas internas y liberaciones de momento

Cada barra de pórtico conserva las traslaciones de los nudos que la conectan. Una liberación desacopla el giro de una cara de barra y anula el momento transmitido por ella. El apoyo articulado externo restringe ambas traslaciones y permite el giro común de los extremos rígidos que inciden en el nudo.

Selecciona una barra configurada como pórtico y usa **Rótula / Liberar momento** en el Inspector. Las casillas i y j controlan las dos caras. **Insertar rótula interior** reutiliza la división con posición física desde i, conserva propiedades y redistribuye cargas. El nuevo nudo y las dos liberaciones se deshacen juntos. Una división ordinaria conserva las liberaciones externas. La inversión intercambia i y j. Los círculos se dibujan cerca del nudo, sobre cada barra afectada.

El esquema JSON v6 registra las liberaciones por barra. Los proyectos v1–v5 conservan sus extremos rígidos. IndexedDB usa la misma migración documental. Una edición de liberaciones cambia la revisión física.

El motor condensa rigidez y carga consistente mediante el complemento de Schur. La forma energética deja tres, dos o un modo según se liberen cero, uno o dos giros. Recupera los giros desde la ecuación local de equilibrio, con desplazamientos de cuerda y carga de barra. Un momento nodal requiere al menos un extremo rígido incidente. La comprobación de rango sigue activa.

| Método | Alcance |
| --- | --- |
| Rigideces y deformada | Giros recuperados por cara y traslaciones nodales compartidas. |
| Trabajo virtual | Preserva las liberaciones en los sistemas unitarios. Diagnostica consultas que requieren aplicar un momento unitario en una cara libre. |
| Método de las fuerzas | Conserva las liberaciones en la primaria y descuenta sus modos eliminados al calcular el grado de hiperestaticidad. |
| Hardy Cross | Para cuerda sin desplazamiento relativo apreciable, usa 3EI/L y transporte cero en el extremo rígido opuesto a una liberación. Conserva el diagnóstico de traslación apreciable. |
| Influencia | Usa el mismo motor y las mismas liberaciones en los casos móviles. |

| Oráculo estático | Resultado independiente contrastado |
| --- | --- |
| Gerber de 10 m, carga de 12 kN en x=8 m | RA = −3, RB = 9, RD = 6 kN. M(B) = −12 kN·m. Momento nulo en ambas caras de C. |
| Dos semivigas empotradas de 4 m | Reacciones de 6 kN, flecha común y giros de igual magnitud con signos opuestos. |
| Pórtico en L | La cara de viga liberada transmite 0 kN·m. El momento nodal de 9 kN·m llega a la columna. |
| Viga biarticulada con 5 kN/m | Reacciones de 10 kN, flecha central de Euler–Bernoulli y momentos de extremo nulos. |
| Dos tramos con rótula interior y apoyos simples exteriores | El motor diagnostica el mecanismo. |

El oráculo móvil Gerber comprueba las ordenadas de las tres reacciones en S = 6 y 8 m por equilibrio de los tramos. La prueba de CAD comprueba la edición y el deshacer de una inserción.
