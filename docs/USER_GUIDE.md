# Guía de usuario · análisis de estructuras

Consulta las herramientas CAD y la gestión de proyectos en el [README](../README.md). La [guía de cargas](LOADS_USAGE.md) incluye los controles para fuerzas y momentos.

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

## Ejercicio de comprobación

1. Crea una barra B1 desde (0, 0) hasta (6, 0) m.
2. Asigna un apoyo articulado al nudo inicial y un rodillo horizontal al final.
3. Configura B1 como **Pórtico 2D** con E = 200 GPa, A = 200 cm² e I = 800 cm⁴. Pulsa **Guardar propiedades**.
4. Aplica una **Carga puntual sobre barra** en s = 3 m, con Fy = −12 kN en global y Fx = 0.
5. Calcula. Comprueba Ry = +6 kN en cada apoyo. En la estación de 3 m, comprueba M = +18 kN·m, v′ = −33,75 mm y V = +6 kN a la izquierda y −6 kN a la derecha.

Las propiedades pasan al JSON de esquema 2 y se recuperan al abrir el proyecto. Si importas un JSON de esquema 1, las barras conservan su geometría y quedan por configurar. Al recargar, vuelve a ejecutar el análisis para obtener resultados de la nueva sesión.
