# Guía de usuario · análisis de estructuras

Consulta las herramientas CAD y la gestión de proyectos en el [README](../README.md). La [guía de cargas](LOADS_USAGE.md) incluye los controles para fuerzas y momentos.

## Abrir un ejercicio

1. Abre **Proyectos → Ejemplos** y elige uno de los seis ejercicios. Lee su planteamiento y despliega **Resultados de referencia** para ver valores, signos y unidades.
2. Pulsa **Abrir copia editable**. Se guarda un proyecto nuevo con su propio ID. Para inspeccionar apoyos, cargas y propiedades, pulsa los objetos del lienzo antes de analizar.
3. Pulsa **Analizar estructura**. Consulta desplazamientos y reacciones, selecciona una barra y abre **Opciones AVM** para ver axial, cortante, momento o la deformada. Si el panel reduce el área visible, usa **Ajustar vista**. Elige **Aprender → Desarrollo** para recorrer las matrices.
4. Vuelve a **Proyectos** para reabrir tu copia, guardarla con otro nombre o descargarla con **Exportar JSON**. Si abres otra copia del ejercicio, tendrás dos proyectos independientes.

**Guía rápida** está en Proyectos. El Inspector ofrece ayudas desplegables junto a apoyos, cargas y propiedades mecánicas. En Aprender, **Cómo interpretar los resultados** explica signos, desplazamientos, equilibrio y mecanismos.

## Preparar y calcular

1. Dibuja los nudos y barras. Asigna apoyos y cargas a los elementos que correspondan.
2. Selecciona una barra con **Seleccionar (V)**. En el Inspector abre **Propiedades mecánicas**. Elige **Armadura 2D** para comportamiento axial o **Pórtico 2D** para comportamiento axial y flexional. Introduce E en GPa y A en cm². Los pórticos requieren además I en cm⁴. El formulario muestra EA en N y EI en N·m² con los valores confirmados.
3. Pulsa **Guardar propiedades** para aplicar. Puedes guardar un tipo y dejar campos pendientes mientras preparas el modelo. **Cancelar cambios** limpia el borrador. **Quitar asignación** retira las propiedades de la barra. Deshacer y Rehacer afectan el modelo completo.
4. Con varias barras seleccionadas, el Inspector muestra los valores comunes y señala los diferentes. Escribe solo los campos que quieras modificar. Si hay barras sin tipo, selecciónalo antes de confirmar con **Aplicar a las barras seleccionadas**.
5. Pulsa **Analizar estructura**. El caso activo incluye todas las cargas por defecto. Para elegir un subconjunto, abre **Caso activo**, desmarca **Incluir automáticamente todas las cargas** y ajusta la selección. Calcula de nuevo al cambiar el caso.

Un diagnóstico con ID permite seleccionar la entidad afectada. Usa **Volver al Inspector** para editarla. Si cambias el modelo físico, aparece **Resultado desactualizado** y se ocultan las tablas. Cambiar la vista, Snap o UCS conserva el resultado vigente.

## Consultar resultados

- **Desplazamientos globales** muestra ux y uy en mm y θz en radianes en los nudos que tienen giro activo.
- **Reacciones globales** muestra Rx y Ry en kN. Los empotramientos con giro activo muestran Mz en kN·m.
- **Esfuerzos por barra** muestra N en tracción o compresión y la variación axial de longitud de una armadura. En pórticos muestra las acciones locales de extremo y permite consultar N, V, M y desplazamientos de sección. Mide **Estación s** desde el nudo inicial. En una carga puntual, el lado izquierdo y el derecho muestran el salto de cortante.
- Selecciona una barra en el lienzo o en el selector de resultados para consultar sus valores. Pulsa el ID de un nudo en una tabla para resaltarlo.
- **Resolver** presenta los valores y balances. **Aprender** añade **Detalle matemático**. Elige un paso y, cuando corresponda, un componente. En matrices grandes, usa **Comienzo de filas** y **Comienzo de columnas**. **Copiar bloque** conserva la precisión del motor en texto separado por tabulaciones.

## Cargas móviles y distribución de momentos

- **Líneas de influencia.** En **Resultados → Método de análisis**, define las barras en orden, el objetivo fijo y la dirección. Para arrancar, abre la viga simplemente apoyada, usa B1 y consulta M a 3 m. Una vez calculada la línea, mueve S o habilita un tren con fuerzas y separaciones por eje. **Máximo** y **Mínimo** llevan a posiciones críticas. [Controles y límites](HITO_7_3_INFLUENCE_LINES.md)
- **Distribución de momentos.** Selecciona el método con un modelo compatible y calcula el caso activo. En **Aprender**, consulta factores, momentos de empotramiento y los barridos que equilibran los giros libres. Para probarlo, abre la viga con carga distribuida del catálogo. Después selecciona **M · Momento** en AVM para ver el campo recuperado. [Condiciones de aplicación](HITO_7_4_MOMENT_DISTRIBUTION.md)

## Ejercicio de comprobación · Viga con carga central

1. Crea una barra B1 desde (0, 0) hasta (6, 0) m.
2. Asigna un apoyo articulado al nudo inicial y un rodillo horizontal al final.
3. Configura B1 como **Pórtico 2D** con E = 200 GPa, A = 200 cm² e I = 800 cm⁴. Pulsa **Guardar propiedades**.
4. Aplica una **Carga puntual sobre barra** en s = 3 m, con Fy = −12 kN en global y Fx = 0.
5. Calcula. Comprueba Ry = +6 kN en cada apoyo. En la estación de 3 m, comprueba M = +18 kN·m, v′ = −33,75 mm y V = +6 kN a la izquierda y −6 kN a la derecha.

Las propiedades se guardan en JSON de esquema 4, que conserva los datos de v2 y la biblioteca de v3. Desde el esquema 1 se conserva la geometría con mecánica pendiente. Al recargar, vuelve a ejecutar el análisis para obtener resultados de la nueva sesión. Los proyectos permanecen en ese navegador y origen web. Exporta un JSON antes de trasladar el proyecto a otro navegador o al sitio público.

## Consultar diseño estructural

Abre **Diseño estructural**, selecciona una barra y analiza un caso estático. Consulta la estación y el lado, usa **Ver sección en AVM** para llevar la posición al diagrama y declara resistencias o límites solo cuando el ejercicio los indique. La flexión requiere el contorno de una sección asignada y un eje principal compatible. El criterio transversal compara el desplazamiento absoluto o la desviación respecto a la cuerda de la barra en la estación elegida. [Convenciones y alcance del diseño](HITO_8_1_DESIGN_FOUNDATIONS.md)
