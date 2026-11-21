# Guía de cargas estructurales

Crea una barra de 10 m desde `N1 = (0, 0)` hasta `N2 = (10, 0)`. Para cada ejemplo, abre **Carga**, elige un subtipo y selecciona un elemento compatible. Confirma con **Crear carga**. Puedes repetir el subtipo seleccionando otro elemento, o usar **Nueva carga** para añadir otra al mismo. El atajo **C** permite acceder al formulario general.

| Ejemplo | Elemento | Valores de entrada | Resultado en el lienzo |
| --- | --- | --- | --- |
| Fuerza y momento nodales | N1 | **Fuerza nodal** con Fx = −1,2 kN y Fy = 0,5 kN. Después, **Momento nodal** con Mz = −2,5 kN·m | Fuerza hacia la izquierda, fuerza hacia arriba y momento horario. |
| Fuerza puntual local | B1 | Puntual, sistema local, s = 3 m, Fx′ = 4 kN, Fy′ = −2 kN | Flecha inclinada a la derecha y hacia abajo. Aparece al 30 % de la longitud. |
| Carga uniforme global | B1 | Distribuida uniforme, sistema global, **Usar toda la barra**, qx = 0 y qy = −2 kN/m | Flechas iguales hacia abajo en todo el tramo. |
| Carga triangular parcial | B1 | Distribuida variable, sistema local, s₀ = 2 m, s₁ = 6 m, q₀ = (0, 0) y q₁ = (0, 5) kN/m | Flechas hacia arriba con intensidad creciente desde cero. |
| Carga trapezoidal parcial | B1 | En la triangular, edita q₀ a (0, 3) y aplica los cambios | Flechas hacia arriba con intensidad creciente entre 3 y 5 kN/m. |

### Consultar y editar

Al crear una fuerza o intensidad, el ángulo parte de 270° en global. Introduce una magnitud positiva para obtener una acción hacia abajo o ajusta el ángulo desde +X en sentido antihorario. Las componentes admiten signos y se sincronizan con la magnitud y el ángulo. La rueda de las fuerzas nodales y puntuales admite ratón o teclas de flecha, con pasos de 1° o de 15° manteniendo Mayús. El momento admite su propio signo.

Con **Seleccionar (V)**, pulsa sobre una flecha, arco o línea de la distribución. Puedes alternar con Ctrl/Cmd o añadir con Mayús. Si el trazo coincide con un nudo o una barra, usa Alt + clic. Repite Alt + clic en el mismo punto para recorrer las cargas que coincidan. La selección por ventana incluye una carga completa de izquierda a derecha y admite el cruce de cualquier trazo de derecha a izquierda. También puedes seleccionar el nudo o barra y pulsar el ID de la carga en su Inspector.

**Aplicar cambios a la carga** guarda la edición y **Quitar carga** elimina ese ID. Los cambios válidos se dibujan en verde con línea discontinua hasta confirmarlos. Pulsa **Esc** o **Cancelar formulario** para descartarlos. Al cambiar el sistema de referencia, las entradas se interpretan en los ejes elegidos. Introduce los componentes en esos ejes si deseas preservar la misma fuerza física.

### Probar los cambios de geometría

En un ejercicio con solo la carga puntual del ejemplo, usa **Mover (M)** para llevar N2 a `(0, 6)`. La carga permanece a 3 m de N1 y el porcentaje pasa al 50 %. La fuerza local gira con la barra. Una fuerza global mantendría su sentido. Si mueves N2 a `(0, 2)`, el editor rechaza el traslado e identifica la carga que quedaría fuera. Con la carga uniforme de 10 m presente, ese intervalo también debe ajustarse antes de acortar la barra.

Prueba **Deshacer** después de quitar una carga o de borrar su nudo o barra. Se recuperan el ID, las componentes, el marco y el tramo originales. Un intervalo que ocupaba toda la barra conserva sus distancias iniciales si la barra se alarga.
