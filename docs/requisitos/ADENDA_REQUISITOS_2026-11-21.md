# AULA ESTRUCTURAL — ADENDA DE REQUISITOS Y ACLARACIONES
## Complemento obligatorio al documento maestro de transferencia

**Fecha:** 21 de noviembre de 2026

Este documento complementa el contexto maestro de Aula Estructural. No reemplaza las decisiones anteriores sobre arquitectura, geometría, unidades, coordenadas, Snap, selección múltiple ni desarrollo por hitos.

Su finalidad es recuperar requisitos funcionales que quedaron resumidos u omitidos en el primer documento y especificar con mayor precisión el comportamiento esperado de la interfaz.

Las decisiones marcadas como acordadas deben conservarse. Los detalles identificados como recomendaciones de implementación pueden ajustarse si existe una justificación técnica, pero no deben cambiarse silenciosamente.

---

# 1. COMPORTAMIENTO DEL CLIC DERECHO

El clic derecho debe funcionar de forma contextual, siguiendo la filosofía de interacción de programas CAD como AutoCAD.

No debe tener una única función fija.

Su comportamiento depende del estado de la aplicación.

## 1.1. Comando activo

Cuando existe una herramienta o comando activo, el clic derecho debe mostrar un menú contextual relacionado con esa herramienta.

El menú puede ofrecer:
- Finalizar comando.
- Cancelar comando.
- Repetir el último comando, cuando corresponda.
- Opciones específicas de la herramienta activa.

También se contempla utilizar el clic derecho como una acción rápida de confirmación o finalización, siguiendo el comportamiento CAD.

No debe finalizar ni cancelar operaciones de manera impredecible. Debe respetar el estado interno de la herramienta.

## 1.2. Modo de selección

Cuando no existe un comando activo y la aplicación está en modo de selección, el menú debe depender del objeto sobre el que se hace clic derecho.

### Sobre un nudo
- Editar coordenadas.
- Consultar propiedades.
- Copiar.
- Eliminar.
- Crear barra desde el nudo, si la operación está disponible.

### Sobre una barra
- Editar propiedades.
- Consultar longitud y geometría.
- Dividir barra.
- Invertir sentido.
- Copiar.
- Eliminar.

### Sobre varios objetos
- Copiar.
- Eliminar.
- Mover, si corresponde.
- Editar propiedades comunes.
- Ejecutar operaciones compatibles con toda la selección.

### Sobre el lienzo vacío
- Crear nudo.
- Configurar cuadrícula.
- Ajustar vista.
- Limpiar selección.
- Acceder a opciones generales.

Si existe una selección múltiple y el clic derecho se realiza sobre un objeto seleccionado, las acciones compatibles deben operar sobre la selección completa.

Si el objeto bajo el cursor no forma parte de la selección, el comportamiento debe ser explícito y no modificar la selección silenciosamente.

## 1.3. Reglas generales del menú contextual

- Aparece cerca del cursor.
- Respeta los límites de la ventana.
- Cambia según el contexto.
- No modifica la geometría al abrirse.
- No modifica accidentalmente la selección.
- Esc permite cerrarlo.
- Las acciones de modificación deben integrarse con Undo/Redo.
- Los atajos deben mostrarse cuando existan.
- No deben mostrarse acciones que no sean aplicables.

La implementación debe contemplar los estados de comando, selección y lienzo vacío.

---

# 2. MODOS DE USO: APRENDER Y RESOLVER

La aplicación debe contemplar dos modos diferenciados.

## 2.1. Aprender

Orientado a comprender los procedimientos del análisis estructural.

Debe priorizar:
- Explicaciones.
- Ecuaciones.
- Variables.
- Sustitución de valores.
- Desarrollo matemático.
- Diagramas.
- Resultados intermedios.
- Relación entre el cálculo y el modelo.

## 2.2. Resolver

Orientado a resolver ejercicios de manera eficiente.

Debe priorizar:
- Definición del modelo.
- Selección del objetivo.
- Configuración del análisis.
- Ejecución del procedimiento.
- Resultados numéricos.
- Diagramas.
- Acceso al procedimiento detallado.

Los dos modos deben tener una identidad funcional propia. No deben ser simplemente dos nombres para la misma pantalla.

---

# 3. SECCIÓN INDEPENDIENTE DE RESULTADOS

Los resultados deben tener una sección independiente del modelador.

Debe permitir consultar:
- Resultados numéricos.
- Diagramas.
- Tablas.
- Ecuaciones.
- Procedimientos.
- Resultados intermedios.
- Explicaciones.

Debe existir una vista resumida y otra detallada.

La sección debe mantener la relación con el modelo estructural original, de modo que los resultados puedan identificarse visualmente.

---

# 4. EDITOR DE SECCIONES

Se requiere un editor gráfico y matemático de secciones estructurales.

No debe limitarse a almacenar propiedades introducidas manualmente.

Debe permitir definir la geometría de una sección y calcular:

- Área.
- Centroide.
- Momentos de inercia.
- Otras propiedades geométricas necesarias para el análisis.

Debe mostrar el desarrollo de los cálculos.

Para secciones compuestas, debe contemplar:
- Áreas parciales.
- Centroides parciales.
- Centroide global.
- Momentos de inercia.
- Teorema de ejes paralelos cuando corresponda.

La interfaz debe relacionar la representación geométrica con los resultados numéricos.

Debe permitir consultar cómo se obtuvieron las propiedades.

---

# 5. TRABAJO VIRTUAL

La herramienta de trabajo virtual debe tener una orientación visual y educativa.

Debe permitir:
- Mostrar la estructura original.
- Mostrar los diagramas del sistema real.
- Mostrar los diagramas del sistema virtual o unitario.
- Identificar contribuciones por elemento.
- Mostrar las integrales.
- Descomponer los cálculos por segmentos.
- Mostrar áreas y centroides cuando corresponda.

## Interacción fundamental

Cuando el usuario haga clic en una contribución de la integral, la aplicación debe resaltar el segmento correspondiente de la estructura original.

La selección de una contribución matemática debe estar vinculada al elemento físico del modelo.

El usuario debe poder comprender qué tramo y qué diagramas intervienen en cada término.

---

# 6. LÍNEAS DE INFLUENCIA Y TRENES DE CARGA

No se busca únicamente representar una línea de influencia.

Se desea una herramienta interactiva.

Debe contemplar:
- Selección de la respuesta estructural de interés.
- Cálculo y visualización de líneas de influencia.
- Consulta de valores relevantes.
- Representación de trenes de carga.
- Desplazamiento de las cargas.
- Actualización de la respuesta calculada.
- Presentación de resultados resumidos.

Se había considerado el uso de chips o indicadores compactos para destacar valores relevantes.

El usuario debe poder elegir qué respuesta desea estudiar, no depender de una única salida predeterminada.

---

# 7. MÉTODO DE LAS FUERZAS

La selección de redundantes debe ser manualmente controlable por el usuario.

La aplicación puede sugerir redundantes, pero no debe limitarse a una selección automática.

Debe poder mostrar el procedimiento correspondiente y relacionar los sistemas auxiliares con el modelo original.

---

# 8. FORMULARIOS Y EXPLICACIÓN GRÁFICA DE ECUACIONES

Los formularios deben explicar las variables de las ecuaciones que utilizan.

No deben limitarse a mostrar campos numéricos.

Cuando corresponda, deben incluir:
- Representación gráfica de las variables.
- Identificación de cada variable.
- Significado físico.
- Unidad.
- Referencia geométrica.
- Relación con la ecuación.

El objetivo es facilitar la comprensión y reducir errores de introducción de datos.

---

# 9. SELECCIÓN DE OBJETIVOS DE ANÁLISIS

El usuario debe poder elegir directamente qué desea analizar.

La selección puede realizarse desde el entorno gráfico o desde una lista de objetivos disponibles.

La aplicación también puede sugerir objetivos compatibles con el modelo.

Ejemplos:
- Calcular una respuesta.
- Obtener una línea de influencia.
- Calcular un desplazamiento.
- Resolver mediante un método disponible.

Las sugerencias deben considerar la información y las condiciones actuales del modelo.

El usuario conserva el control de la decisión.

---

# 10. REPOSITORIO Y DOCUMENTACIÓN

El proyecto debe poder compartirse públicamente.

El repositorio debe incluir:
- Código fuente.
- Documentación.
- Instrucciones de instalación.
- Ejemplos.
- Pruebas.
- Información de uso.

La publicación inicial puede realizarse mediante GitHub Pages.

La arquitectura debe mantener la posibilidad de incorporar servicios de nube en el futuro, sin convertirlos en una dependencia de la primera versión.

---

# 11. REGLAS PARA CODEX

Antes de implementar cualquiera de estas funcionalidades:

1. Inspeccionar el código existente.
2. Identificar qué funcionalidades ya están implementadas.
3. Identificar las que están parcialmente implementadas.
4. Identificar las que faltan.
5. Verificar que las nuevas funciones respeten la arquitectura actual.
6. Proponer una implementación incremental.
7. Evitar reconstruir componentes que ya funcionan.
8. Mantener las decisiones geométricas y estructurales aprobadas.
9. Añadir pruebas.
10. Detenerse al terminar el alcance solicitado y presentar un informe.

No se debe intentar desarrollar todas las funcionalidades educativas y estructurales durante el Hito 1.

Esta adenda amplía los requisitos globales del producto, pero no autoriza adelantar hitos.

La prioridad inmediata sigue siendo recuperar y validar el estado real del Hito 1, incluyendo el lienzo, geometría, Snap, selección múltiple y las interacciones básicas del modelador.