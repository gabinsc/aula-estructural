# Presentación AVM adaptable

La vista individual N, V o M continúa en el lienzo CAD. La vista combinada dispone de un selector de presentación que no solicita un cálculo nuevo. La clasificación automática usa una cadena conectada y colineal, sin ramificaciones ni retrocesos. Una barra, una viga continua recta o una Gerber colineal usan la vista desarrollada. Los pórticos, modelos desconectados y estructuras ramificadas usan la vista compacta.

La vista desarrollada sitúa la referencia encima de N, V y M. Usa una única abscisa física S y conserva el sentido local de cada barra para la consulta. La vista compacta coloca N a la izquierda, el modelo al centro, V a la derecha y M debajo. Las franjas consultan la barra seleccionada por ID. En anchuras reducidas, las cuatro piezas se apilan para mantener la legibilidad. El selector de barra también permite navegar con teclado.

Las franjas tienen escalas independientes con unidades, altura configurable, visibilidad, orden vertical y opciones para valores críticos y discontinuidades. La estación activa se comparte entre franjas y el lado de la discontinuidad es explícito. Los cortes y extremos provienen del modelo de diagramas existente. La deformada se traza por barra y conserva los cambios de pendiente de las rótulas.

| Verificación | Evidencia |
| --- | --- |
| Vigas continuas con barras invertidas, carga puntual y carga distribuida | Playwright verifica el orden de los tres tramos, estaciones sincronizadas y salto de V. |
| Pórtico inclinado | Playwright verifica la posición relativa de N, V y M y la selección por ID. |
| Selector manual y pantalla estrecha | Playwright comprueba el cambio de disposición y el orden de apilamiento. |
| Vigencia y armaduras | Playwright oculta diagramas desactualizados y comprueba que V y M no aplican a barras axiales. |

[AVM desarrollado](media/rotulas-avm-viga-continua.png) · [AVM compacto](media/rotulas-avm-portico-compacto.png) · [Pantalla estrecha](media/rotulas-avm-portico-movil.png)
