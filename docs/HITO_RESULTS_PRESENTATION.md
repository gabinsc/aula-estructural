# Precisión y etiquetas de resultados

Las opciones AVM permiten mostrar IDs, cargas, reacciones, etiquetas y extremos, y controlar los decimales y la distribución automática. El formateador visual convierte unidades de presentación y conserva pequeñas magnitudes significativas en notación científica. Solo suprime residuos compatibles con el redondeo de Float64 respecto a una referencia de la misma magnitud. Las tablas de reacciones y desplazamientos conservan un valor de mayor precisión en el detalle de cada celda. El desarrollo educativo utiliza el formato de cálculo.

El lienzo detecta colisiones en píxeles CSS con símbolos de nudos, apoyos, rótulas y cargas. Reserva primero las marcas existentes, luego coloca las etiquetas de carga, reacción y resultado consultado. Reubica las etiquetas que se cruzan y oculta aquellas para las que no encuentra espacio. La consulta y el Inspector conservan el acceso a los datos. Este ajuste se vuelve a calcular con zoom, pan y cambios del modelo. Las preferencias son visuales y quedan fuera de Undo/Redo y de la revisión física.

Las pruebas de formato verifican residuos positivos o negativos, cero con signo, magnitudes pequeñas significativas, precisión configurable y lectura exacta. La densidad de cotas y etiquetas en vistas muy congestionadas sigue dependiendo del espacio efectivo del lienzo.

[Distribución desactivada](media/rotulas-avm-etiquetas-antes.png) · [Distribución automática](media/rotulas-avm-etiquetas-despues.png)
