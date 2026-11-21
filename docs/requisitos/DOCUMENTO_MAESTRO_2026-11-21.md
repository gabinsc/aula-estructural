# AULA ESTRUCTURAL
## Documento maestro de contexto y transferencia del proyecto

**Fecha de actualización:** 21 de noviembre de 2026  
**Estado:** Fase inicial de desarrollo – Hito 1  
**Plataforma objetivo:** Aplicación web 2D  
**Uso principal:** Análisis estructural y aprendizaje de los métodos del curso  
**Herramienta de desarrollo asistido:** Codex

---

# 1. DESCRIPCIÓN GENERAL DEL PROYECTO

Aula Estructural es un proyecto de desarrollo de una aplicación web orientada al análisis estructural en dos dimensiones (2D), tomando como referencia los contenidos y métodos desarrollados en el curso de Análisis Estructural.

La finalidad no es crear únicamente una calculadora de estructuras. Se busca desarrollar un entorno de trabajo gráfico e intuitivo, similar a un programa CAD, donde el usuario pueda dibujar una estructura, definir sus propiedades, establecer condiciones de apoyo, introducir cargas y posteriormente analizarla mediante distintos métodos estructurales.

Un aspecto fundamental es que la aplicación debe tener una orientación tanto práctica como educativa.

Por ello, debe ofrecer dos niveles de visualización:

- **Modo resumido:** presentar los resultados principales de manera clara y directa.
- **Modo detallado:** mostrar el procedimiento matemático, las ecuaciones utilizadas, los valores intermedios y la interpretación de los resultados.

El objetivo es que un estudiante pueda utilizar la aplicación para resolver ejercicios, comprender los procedimientos y verificar sus propios cálculos.

La aplicación deberá poder compartirse con compañeros de universidad y, en el futuro, evolucionar hacia una plataforma más completa.

## 1.1. Objetivos principales

1. Crear un entorno gráfico 2D para modelar estructuras.
2. Facilitar la definición de nudos, barras, apoyos y cargas.
3. Incorporar progresivamente los métodos de análisis estructural estudiados en el curso.
4. Mostrar los procedimientos matemáticos y no solamente los resultados finales.
5. Permitir visualizar gráficamente los diagramas y resultados.
6. Relacionar los resultados matemáticos con los elementos de la estructura original.
7. Crear una aplicación suficientemente organizada para incorporar nuevos métodos y funcionalidades en el futuro.
8. Publicar una versión funcional que pueda ser utilizada y probada por otros estudiantes.

## 1.2. Filosofía de desarrollo

El proyecto debe desarrollarse por etapas.

No se debe intentar implementar todos los métodos de análisis estructural desde el principio. Primero se necesita construir una base gráfica y geométrica confiable.

La prioridad es conseguir que el modelador funcione correctamente antes de desarrollar el motor de cálculo estructural.

Cada fase debe terminar con una versión funcional, pruebas y una revisión antes de continuar.

---

# 2. ALCANCE ACADÉMICO

La aplicación se plantea inicialmente para cubrir los contenidos del curso de Análisis Estructural.

Los temas considerados son:

1. Conceptos básicos de análisis estructural.
2. Estructuras isostáticas e hiperestáticas.
3. Trabajo virtual.
4. Líneas de influencia.
5. Método de las fuerzas.
6. Método de las rigideces.
7. Método de distribución de momentos.

La aplicación debe construirse considerando que estos métodos tienen diferentes procedimientos y necesidades de visualización.

No se pretende implementar todos simultáneamente.

## 2.1. Métodos y funcionalidades previstas

### A. Conceptos básicos e isostaticidad

La aplicación deberá permitir:
- Modelar estructuras mediante nudos y barras.
- Definir condiciones de apoyo.
- Identificar grados de libertad.
- Reconocer estructuras isostáticas e hiperestáticas.
- Mostrar información geométrica y estructural del modelo.

### B. Trabajo virtual

Este apartado tiene especial importancia educativa.

Se busca mostrar el procedimiento de cálculo y no únicamente el desplazamiento final.

Funcionalidades previstas:
- Visualizar el sistema estructural original.
- Mostrar los diagramas correspondientes al sistema real y al sistema virtual.
- Identificar las contribuciones de cada elemento.
- Mostrar las integrales utilizadas.
- Descomponer el cálculo por barras o segmentos.
- Mostrar áreas y centroides cuando se utilice el procedimiento de áreas por distancia al centroide.

Una funcionalidad especialmente importante es que el usuario pueda seleccionar o hacer clic en una contribución de la integral y que la aplicación resalte el segmento correspondiente de la estructura original.

Esto permitirá relacionar directamente los términos matemáticos con su representación física.

### C. Líneas de influencia

Se busca incorporar:
- Cálculo de líneas de influencia.
- Representación gráfica.
- Posibilidad de trabajar con trenes de carga.
- Visualización de la posición de las cargas.
- Evaluación de los efectos producidos por diferentes posiciones del tren de carga.

La herramienta deberá facilitar la comprensión de cómo cambia una respuesta estructural al desplazarse una carga.

### D. Método de las fuerzas

Se espera incorporar:
- Selección manual de redundantes.
- Liberación de restricciones o vínculos según el método.
- Construcción de sistemas primarios.
- Cálculo de compatibilidad.
- Visualización de diagramas asociados.
- Desarrollo detallado de las ecuaciones.
- Presentación de resultados y comprobaciones.

La selección manual de redundantes es importante: no se debe limitar al usuario a una selección automática.

### E. Método de las rigideces

Se busca desarrollar:
- Identificación de grados de libertad.
- Matrices de rigidez.
- Ensamblaje de la matriz global.
- Aplicación de condiciones de contorno.
- Incorporación de cargas.
- Resolución del sistema.
- Obtención de desplazamientos y fuerzas.
- Visualización de resultados.
- Explicación de los procedimientos matriciales.

### F. Distribución de momentos

Se busca incorporar:
- Identificación de elementos y nudos.
- Rigideces relativas.
- Factores de distribución.
- Momentos de empotramiento.
- Distribución y transporte de momentos.
- Iteraciones.
- Resultados finales.

La interfaz debe permitir seguir las iteraciones de forma ordenada.

---

# 3. EXPERIENCIA DE USUARIO E INTERFAZ

La aplicación debe tener un entorno gráfico intuitivo, inspirado en programas CAD.

No se busca reproducir toda la complejidad de AutoCAD, sino adoptar los conceptos de interacción que resultan útiles para modelar estructuras.

## 3.1. Modelador gráfico

El área principal de trabajo será un lienzo 2D en el que el usuario podrá dibujar y editar estructuras.

Se espera contar con:
- Cuadrícula.
- Ejes de coordenadas.
- Nudos.
- Barras.
- Selección de objetos.
- Zoom.
- Desplazamiento del lienzo (pan).
- Herramientas de dibujo.
- Panel de propiedades.
- Indicadores de coordenadas.
- Herramientas de referencia y ajuste geométrico.

La representación gráfica debe mantenerse separada de los datos físicos del modelo.

## 3.2. Panel de propiedades

Al seleccionar un objeto, se deberá mostrar un panel con sus propiedades.

Por ejemplo:
- Nudos: coordenadas y propiedades asociadas.
- Barras: nudos inicial y final, longitud y propiedades geométricas.
- En etapas posteriores, apoyos, cargas, materiales y secciones.

Cuando se seleccionen varios objetos, el panel deberá mostrar únicamente las propiedades comunes que puedan editarse conjuntamente.

No debe mostrar valores engañosos cuando los objetos seleccionados tengan propiedades diferentes.

## 3.3. Secciones y materiales

Se tiene previsto incorporar:
- Biblioteca de secciones.
- Biblioteca de materiales.
- Editor de propiedades de sección.
- Posibilidad de introducir propiedades manualmente.

La aplicación deberá poder utilizar las propiedades geométricas y mecánicas necesarias para los métodos de análisis.

## 3.4. Resultados

Los resultados deben presentarse de dos formas:

**Vista resumida**
- Valores principales.
- Desplazamientos.
- Reacciones.
- Fuerzas internas.
- Diagramas.
- Indicadores de equilibrio y estabilidad.

**Vista detallada**
- Ecuaciones.
- Variables.
- Sustitución de valores.
- Resultados intermedios.
- Matrices cuando corresponda.
- Desarrollo paso a paso.

Cuando se muestre una ecuación, se debe explicar qué representa cada variable.

La aplicación debe favorecer el aprendizaje y permitir comprobar cómo se obtiene un resultado.

## 3.5. Asistencia durante el análisis

Se contempla una funcionalidad mediante la cual la aplicación pueda sugerir objetivos o procedimientos de análisis.

Por ejemplo:
- Identificar qué se puede calcular.
- Recomendar un procedimiento.
- Sugerir una selección de redundantes.
- Explicar qué información falta.
- Señalar posibles inconsistencias en el modelo.

Estas sugerencias deben ayudar al usuario, pero no reemplazar las decisiones que se quieran dejar bajo su control.

---

# 4. ARQUITECTURA GENERAL Y ESTRATEGIA TECNOLÓGICA

## 4.1. Arquitectura híbrida y local-first

Una decisión importante del proyecto es utilizar una arquitectura híbrida.

En la primera etapa, el modelado y los cálculos básicos funcionarán localmente en el navegador.

Las funciones que requieren infraestructura de nube se incorporarán después.

### Funcionalidades locales iniciales
- Modelado.
- Geometría.
- Edición.
- Análisis estructural.
- Visualización de resultados.
- Guardado local.
- Importación y exportación de proyectos.

### Funcionalidades futuras de nube
- Cuentas de usuario.
- Sincronización.
- Almacenamiento remoto.
- Colaboración entre usuarios.
- Compartir proyectos.
- Posibles herramientas alojadas.

La arquitectura debe permitir añadir estas funcionalidades sin tener que rehacer la aplicación.

## 4.2. Monetización

La monetización no forma parte del alcance inicial.

Primero se busca:
1. Desarrollar una aplicación funcional.
2. Validar los resultados.
3. Probarla con compañeros.
4. Corregir errores.
5. Evaluar su utilidad.

Posteriormente se podría evaluar ofrecer servicios alojados de pago para cubrir los costos de infraestructura y mantenimiento.

No se debe introducir complejidad comercial durante la primera etapa.

## 4.3. Tecnologías propuestas por Codex

La propuesta inicial de arquitectura fue:

| Componente | Tecnología |
|---|---|
| Interfaz | React |
| Lenguaje | TypeScript |
| Configuración | TypeScript estricto |
| Entorno de desarrollo | Vite |
| Representación gráfica | SVG |
| Pruebas unitarias | Vitest |
| Pruebas de interfaz | Playwright |
| Persistencia futura | IndexedDB |
| Intercambio de proyectos | JSON |
| Publicación inicial | GitHub Pages |

Estas tecnologías fueron propuestas para el proyecto y constituyen la base de trabajo aprobada hasta el momento.

## 4.4. Organización por capas

La propuesta plantea separar las responsabilidades del sistema.

### Dominio (domain)

Debe contener los conceptos propios del problema estructural:
- Nudos.
- Barras.
- Propiedades.
- Identificadores.
- Entidades del modelo.

No debe depender de componentes visuales.

### Geometría (geometry)

Debe encargarse de:
- Transformaciones.
- Coordenadas.
- Distancias.
- Intersecciones.
- Cálculos geométricos.
- Conversión entre coordenadas del modelo y pantalla.

### Aplicación (application)

Debe encargarse de:
- Comandos.
- Operaciones sobre el proyecto.
- Gestión de cambios.
- Acciones de edición.
- Futuras operaciones de análisis.

### Modelador (modeler)

Debe contener:
- Lienzo.
- Herramientas.
- Selección.
- Inspector.
- Interacciones gráficas.
- Representación SVG.

### Infraestructura (infrastructure)

Debe encargarse de:
- Persistencia.
- Importación y exportación.
- Adaptadores.
- Futuras conexiones con servicios externos.

La separación de estas capas es importante para evitar que toda la lógica termine dentro de los componentes de React.

---

# 5. ESTADO DEL PROYECTO AL INICIAR EL DESARROLLO

La carpeta de trabajo inicial indicada a Codex fue:

`aula-estructural/`

En ese momento:
- El directorio estaba vacío.
- No existía código fuente.
- No había repositorio Git inicializado.
- No existía una implementación previa.

Codex realizó una propuesta de diagnóstico y arquitectura inicial.

Se acordó no desarrollar todo de golpe, sino dividirlo en tres hitos.

## 5.1. Hito 1: lienzo y geometría básica

Objetivo:
Construir el entorno gráfico y permitir modelar una estructura básica.

Incluye:
- Configuración inicial del proyecto.
- Interfaz.
- Lienzo SVG.
- Cuadrícula.
- Ejes.
- Zoom.
- Pan.
- Nudos.
- Barras.
- Coordenadas.
- Selección básica.
- Conversión de coordenadas.
- Pruebas.

No incluye todavía:
- Apoyos.
- Cargas.
- Análisis estructural.
- Motor de cálculo.

**Estado:** es el hito que se estaba trabajando cuando se interrumpió la conversación.

## 5.2. Hito 2: edición estructural

Se planteó incorporar:
- Apoyos.
- Cargas.
- Herramientas de edición.
- Menús contextuales.
- División de barras.
- Copiar y pegar.
- Deshacer.
- Rehacer.
- Operaciones de edición más completas.

Se debe empezar únicamente después de validar el Hito 1 y las funcionalidades adicionales que se solicitaron para el modelador.

## 5.3. Hito 3: persistencia y publicación

Se planteó incorporar:
- Guardado mediante IndexedDB.
- Autoguardado.
- Importación y exportación JSON.
- Validación de proyectos.
- Preparación para GitHub Pages.

La publicación inicial debe ser sencilla y no depender de un backend.

---

# 6. DECISIONES TÉCNICAS IMPORTANTES YA DEFINIDAS

Esta sección contiene decisiones que deben respetarse en futuras implementaciones.

No se deben cambiar sin evaluar primero sus consecuencias.

## 6.1. Cruces entre barras

**Decisión:** el cruce geométrico entre dos barras no genera automáticamente una conexión estructural.

Ejemplo:

Si una barra horizontal y una barra vertical se cruzan, la aplicación no debe asumir que existe un nudo compartido.

El usuario debe crear explícitamente esa conexión.

En el futuro se incorporará una operación denominada conceptualmente:

**Create joint at intersection / Crear nudo en intersección.**

Esta operación deberá:
1. Detectar la intersección.
2. Dividir las barras correspondientes.
3. Crear un nudo compartido.
4. Reasignar correctamente las conexiones.
5. Ejecutarse como una única operación.
6. Poder deshacerse mediante un solo comando de Undo.

La geometría visual y la conectividad estructural deben ser conceptos independientes.

## 6.2. Cargas aplicadas sobre barras

Cuando se implementen cargas distribuidas o puntuales sobre barras, su posición debe almacenarse mediante una distancia física.

Se acordó utilizar:

`s = distancia desde el nudo inicial de la barra`

También se puede calcular:

`t = s / L`

Donde:
- `s`: distancia física desde el inicio de la barra.
- `L`: longitud de la barra.
- `t`: coordenada normalizada entre 0 y 1.

La distancia física `s` debe ser la referencia principal.

No se debe almacenar exclusivamente `t`.

### ¿Por qué?

Si una barra cambia de longitud, conservar únicamente el valor normalizado podría desplazar físicamente la carga.

Por defecto, al modificar la longitud de una barra, se debe intentar conservar la distancia física de aplicación.

Si la distancia deja de ser válida porque la barra se acortó, la aplicación debe advertirlo.

### Cuando se divide una barra

Si una barra se divide:
- Las cargas deben reasignarse a los nuevos segmentos.
- Deben conservarse sus propiedades físicas.
- Si una carga queda exactamente en el nuevo nudo, debe convertirse en una carga nodal equivalente, sin modificar su efecto físico.

## 6.3. Sistemas de coordenadas

Se definieron varios sistemas de coordenadas.

### Global

Es el sistema físico de referencia de toda la estructura.

La geometría real se almacena en coordenadas globales.

### UCS (User Coordinate System)

Es un sistema de coordenadas de trabajo que facilita la introducción de geometría.

Puede cambiar su orientación y posición para facilitar el dibujo.

**Regla fundamental:** cambiar el UCS nunca debe modificar las coordenadas físicas globales de los elementos ya existentes.

El UCS solo transforma las coordenadas introducidas por el usuario hacia el sistema global.

### Relativo

Permite introducir una posición con respecto a un punto de referencia.

### Polar

Permite introducir posiciones mediante:
- Distancia.
- Ángulo.

### Local de barra

Sistema asociado a una barra.

Será necesario para introducir cargas locales y realizar cálculos estructurales.

La implementación puede ser progresiva, pero la arquitectura debe contemplar estos sistemas.

## 6.4. Unidades internas y convenciones

Se definió trabajar internamente con:

| Magnitud | Unidad interna |
|---|---|
| Longitud | m |
| Fuerza | N |
| Momento | N·m |
| Ángulo | rad |

En la interfaz se mostrarán preferentemente:

| Magnitud | Unidad visible |
|---|---|
| Longitud | m |
| Fuerza | kN |
| Momento | kN·m |
| Ángulo | grados |

La conversión debe realizarse en la capa correspondiente y no alterar los valores internos.

### Convenciones geométricas

- Eje X positivo hacia la derecha.
- Eje Y positivo hacia arriba.
- Ángulos positivos en sentido antihorario.
- Rotación nodal positiva en sentido antihorario.

### Convención de momentos

Debe distinguirse entre:
- Momentos nodales aplicados.
- Momentos internos de los elementos.

No se debe asumir que ambas convenciones de signos son intercambiables.

La convención de momentos internos de barra debe definirse explícitamente cuando se implemente el motor de análisis.

## 6.5. Apoyos

Se definieron conceptualmente:

**Articulado:**
- Restringe desplazamiento en X.
- Restringe desplazamiento en Y.
- Permite rotación.

**Rodillo:**
- Restringe el desplazamiento normal a su superficie de apoyo.
- Permite el desplazamiento tangencial.
- Permite rotación.

**Empotrado:**
- Restringe desplazamiento en X.
- Restringe desplazamiento en Y.
- Restringe rotación.

Se contempla que posteriormente existan restricciones personalizadas.

---

# 7. FUNCIONALIDAD ADICIONAL: SNAP

Después de plantear el primer modelador, se identificó la necesidad de mejorar la precisión del dibujo.

Se aclaró que el concepto de Snap solicitado tenía dos componentes distintos.

Es importante mantenerlos separados.

## 7.1. Grid Snap (ajuste a cuadrícula)

Esta es la funcionalidad principal solicitada.

Cuando el usuario crea o mueve un nudo, sus coordenadas deben ajustarse automáticamente a incrementos físicos configurables.

Ejemplo:

Si el usuario hace clic aproximadamente en:

`X = 3.72 m`

`Y = 5.36 m`

Y el intervalo de ajuste es de 1 m, el punto debe ubicarse en:

`X = 4.00 m`

`Y = 5.00 m`

El ajuste debe realizarse en coordenadas físicas del modelo, no mediante una aproximación basada únicamente en píxeles.

### Intervalos propuestos

Se plantearon los siguientes valores preestablecidos:

- 0.10 m
- 0.25 m
- 0.50 m
- 1.00 m
- Personalizado

También se planteó permitir intervalos independientes en X e Y.

Por ejemplo:
- X = 0.50 m.
- Y = 0.25 m.

### Reglas

- El intervalo de ajuste debe ser configurable.
- El espaciado visual de la cuadrícula puede ser diferente del intervalo de Snap.
- El ajuste debe ser independiente del zoom.
- Debe funcionar al crear nudos.
- Debe funcionar al dibujar barras.
- Debe funcionar al mover nudos.
- Debe contemplarse para futuras herramientas de geometría.
- Las coordenadas introducidas numéricamente de forma exacta no deben modificarse silenciosamente.

### Interacción

Se propuso:
- Activación y desactivación independiente.
- Activado por defecto.
- Intervalo inicial de 1.00 m.
- Atajo de teclado F9.

## 7.2. Object Snap (referencias a objetos)

Esta funcionalidad es diferente de Grid Snap.

Permite ajustar el cursor a elementos geométricos existentes.

Se propusieron inicialmente:

1. Endpoint: extremo de una barra o nudo existente.
2. Midpoint: punto medio de una barra.
3. Intersection: intersección geométrica de barras.

Posteriormente se podrían añadir:
- Nearest.
- Perpendicular.

### Reglas

- Debe existir una tolerancia visual expresada en píxeles CSS.
- La tolerancia debe mantenerse estable independientemente del zoom.
- Debe mostrarse un indicador visual de la referencia detectada.
- Debe mostrarse una etiqueta que identifique el tipo de referencia.
- Deben mostrarse las coordenadas correspondientes.

Se propuso el atajo F3.

## 7.3. Prioridad de ajuste

La prioridad definida es:

1. Object Snap, si existe una referencia válida dentro de la tolerancia visual.
2. Grid Snap, si no se detectó una referencia de objeto.
3. Coordenadas libres, si ambos sistemas están desactivados.

La lógica debe trabajar en coordenadas del modelo y no depender de la posición visual del objeto en pantalla.

Esto es importante para evitar errores cuando el usuario aplica zoom o desplaza el lienzo.

---

# 8. FUNCIONALIDAD ADICIONAL: SELECCIÓN MÚLTIPLE

También se identificó la necesidad de implementar selección múltiple de elementos.

La selección debe funcionar tanto para nudos como para barras.

## 8.1. Selección individual

- Clic sobre un objeto para seleccionarlo.
- El objeto seleccionado debe resaltarse.
- El inspector debe mostrar sus propiedades.

## 8.2. Selección mediante Ctrl

Se propuso:

`Ctrl + clic`

Para añadir o quitar elementos de la selección actual.

Debe funcionar como un interruptor:
- Si el objeto no está seleccionado, se añade.
- Si ya está seleccionado, se elimina.

## 8.3. Selección mediante Shift

Se propuso:

`Shift + clic`

Para añadir elementos a la selección.

## 8.4. Selección por ventana

Se definieron dos comportamientos:

**Ventana de izquierda a derecha:**

Selecciona únicamente los elementos completamente contenidos dentro del rectángulo.

**Ventana de derecha a izquierda:**

Selecciona los elementos que intersectan el rectángulo.

Esta distinción es habitual en programas CAD y debe mantenerse.

## 8.5. Selección de nudos y barras

La selección puede incluir diferentes tipos de elementos al mismo tiempo.

Por ejemplo:
- Dos nudos.
- Tres barras.
- Una combinación de nudos y barras.

La aplicación debe mostrar:
- Cantidad total de objetos seleccionados.
- Cantidad por tipo.
- Propiedades comunes cuando corresponda.

## 8.6. Edición de elementos seleccionados

Se espera permitir:
- Mover varios nudos.
- Conservar las conexiones entre barras.
- Eliminar elementos seleccionados.
- Editar propiedades comunes.

Importante:

Seleccionar una barra no debe seleccionar automáticamente sus nudos conectados.

La selección de cada entidad debe ser independiente, salvo que en el futuro se implemente una herramienta explícita para seleccionar grupos o estructuras conectadas.

## 8.7. Cancelación

Se propuso utilizar:

`Esc`

Para cancelar operaciones activas o limpiar la selección, según el contexto de la herramienta.

---

# 9. REQUISITOS DE IMPLEMENTACIÓN Y CALIDAD

Codex debe trabajar sobre el proyecto existente y no reconstruirlo desde cero cada vez que se solicite una modificación.

Las instrucciones deben exigir que primero inspeccione el código actual.

## 9.1. Principios

- Mantener la arquitectura establecida.
- Evitar duplicación de lógica.
- Separar dominio, geometría e interfaz.
- Utilizar identificadores estables para nudos y barras.
- Mantener la fuente de verdad del modelo separada de su representación SVG.
- No introducir dependencias innecesarias.
- No implementar funcionalidades de hitos posteriores sin autorización.
- Mantener la compatibilidad con las decisiones anteriores.

## 9.2. Pruebas

Se propusieron:
- Vitest para pruebas unitarias.
- Playwright para pruebas de interacción.

Las pruebas deben cubrir, entre otros aspectos:
- Transformaciones de coordenadas.
- Creación de nudos.
- Creación de barras.
- Selección.
- Snap.
- Selección múltiple.
- Operaciones geométricas.

## 9.3. Criterio de finalización

Cada hito debe terminar con:
- Código funcional.
- Pruebas ejecutadas.
- Errores corregidos.
- Resumen de cambios.
- Archivos relevantes.
- Limitaciones conocidas.
- Confirmación de que no se avanzó indebidamente al siguiente hito.

---

# 10. ESTADO EXACTO EN EL QUE SE DEJÓ EL PROYECTO

La conversación quedó en el momento en que se estaban refinando las instrucciones para Codex.

Se había trabajado sobre la propuesta inicial de Hito 1 y posteriormente se identificaron dos funcionalidades adicionales importantes:

1. Snap, especialmente el ajuste de coordenadas a incrementos físicos de la cuadrícula.
2. Selección múltiple de nudos y barras.

Se entregó una instrucción adicional a Codex para integrar estas funcionalidades con el modelador existente.

La instrucción insistía en:
- Inspeccionar el código existente.
- No reconstruir el proyecto.
- Integrar las nuevas funcionalidades con la arquitectura actual.
- Mantener las reglas geométricas anteriores.
- Añadir pruebas.
- No avanzar al Hito 2.
- Detenerse al terminar y presentar un resumen.

**No hay confirmación en el contexto disponible de que Codex haya terminado de implementar estas modificaciones ni de que el Hito 1 esté validado.**

Por lo tanto, el siguiente paso no debe ser asumir que el código está terminado.

Primero se debe recuperar el estado real del repositorio.

---

# 11. PRÓXIMOS PASOS RECOMENDADOS PARA CONTINUAR

## Paso 1. Recuperar el proyecto

Abrir la carpeta:

`aula-estructural/`

Inspeccionar:
- Estructura de archivos.
- Código actual.
- Estado de Git.
- Dependencias.
- Pruebas existentes.
- Funcionalidades ya implementadas.

No sobrescribir nada antes de revisar el estado.

## Paso 2. Verificar el Hito 1

Comprobar que funcionan:
- Lienzo SVG.
- Cuadrícula.
- Ejes.
- Zoom.
- Pan.
- Nudos.
- Barras.
- Conversión de coordenadas.
- Selección individual.
- Creación de elementos.
- Coordenadas físicas.

## Paso 3. Integrar y validar Snap

Comprobar separadamente:
- Grid Snap.
- Object Snap.
- Prioridad de ajuste.
- Intervalos configurables.
- Atajos F9 y F3.
- Independencia respecto al zoom.
- Compatibilidad con UCS futuro.

## Paso 4. Integrar y validar selección múltiple

Comprobar:
- Ctrl + clic.
- Shift + clic.
- Ventana de izquierda a derecha.
- Ventana de derecha a izquierda.
- Selección mixta.
- Movimiento de varios nudos.
- Eliminación múltiple.
- Inspector de propiedades comunes.

## Paso 5. Revisar decisiones arquitectónicas

Verificar especialmente:
- Identificadores estables.
- Geometría independiente de la interfaz.
- Cruces sin conexión automática.
- Coordenadas globales.
- Unidades internas.
- Separación de capas.

## Paso 6. Validar el Hito 1

Ejecutar las pruebas y realizar una revisión manual de la interfaz.

No continuar hasta que el modelador básico sea estable.

## Paso 7. Iniciar Hito 2

Una vez aprobado el Hito 1, comenzar con apoyos, cargas y operaciones de edición estructural.

---

# 12. INSTRUCCIÓN MAESTRA PARA CODEX

El siguiente texto sirve como instrucción general para mantener el rumbo del proyecto.

No sustituye las instrucciones específicas de cada hito.

## Contexto permanente

Estamos desarrollando Aula Estructural, una aplicación web 2D para modelado y análisis estructural con orientación educativa.

La aplicación debe funcionar como un entorno CAD simplificado para estructuras, permitiendo dibujar, editar, analizar y visualizar resultados.

Se utilizará React, TypeScript estricto, Vite y SVG, siguiendo una arquitectura modular con separación entre dominio, geometría, aplicación, modelador e infraestructura.

El proyecto debe desarrollarse progresivamente, mediante hitos verificables.

## Reglas obligatorias

1. Antes de modificar código, inspecciona la implementación existente.
2. No reconstruyas el proyecto desde cero si ya existe una implementación funcional.
3. No elimines funcionalidades existentes para simplificar el desarrollo.
4. Mantén las decisiones arquitectónicas y geométricas ya aprobadas.
5. Mantén separadas la geometría física y su representación gráfica.
6. Utiliza identificadores estables para nudos y barras.
7. No conviertas automáticamente los cruces geométricos en conexiones estructurales.
8. Al implementar cargas sobre barras, almacena su posición mediante distancia física desde el inicio de la barra.
9. Mantén las coordenadas físicas globales independientes del UCS.
10. Utiliza unidades internas m, N, N·m y radianes.
11. Mantén las convenciones de ejes y signos definidas en este documento.
12. Implementa pruebas para las funcionalidades nuevas.
13. Evita dependencias innecesarias.
14. No adelantes funcionalidades de hitos posteriores sin autorización.
15. Al terminar, informa qué cambió, qué pruebas se ejecutaron, qué queda pendiente y qué limitaciones existen.

## Prioridad del proyecto

La prioridad actual es conseguir un modelador 2D confiable, preciso e intuitivo.

No comenzar todavía el desarrollo del motor de análisis estructural hasta que la base gráfica y geométrica esté validada.

---

# 13. CRITERIOS QUE DEBEN GUIAR LAS DECISIONES FUTURAS

Al evaluar nuevas funcionalidades o cambios de arquitectura, considerar:

- ¿Facilita el modelado estructural?
- ¿Es coherente con el comportamiento de herramientas CAD?
- ¿Mantiene la precisión geométrica?
- ¿Permite ampliar los métodos de análisis?
- ¿Separa correctamente los datos físicos de la visualización?
- ¿Es útil para el aprendizaje?
- ¿Evita que el usuario dependa de resultados que no puede verificar?
- ¿Permite mantener la aplicación local-first?
- ¿Puede incorporarse sin romper las funcionalidades existentes?

La aplicación no debe convertirse en una colección de herramientas desconectadas. Todas las funcionalidades deben trabajar sobre un mismo modelo estructural coherente.

---

# 14. RESUMEN EJECUTIVO PARA UNA NUEVA CONVERSACIÓN

Estamos desarrollando Aula Estructural, una aplicación web 2D para modelar y analizar estructuras, orientada al curso de Análisis Estructural.

La aplicación tendrá un entorno gráfico tipo CAD, con nudos, barras, cuadrícula, coordenadas, selección, herramientas de edición y panel de propiedades.

Posteriormente incorporará apoyos, cargas, secciones, materiales y métodos de análisis estructural: trabajo virtual, líneas de influencia, método de las fuerzas, método de las rigideces y distribución de momentos.

Debe tener dos niveles de resultados: resumido y detallado. El detallado debe mostrar ecuaciones, variables, sustituciones, resultados intermedios y una relación visual entre las operaciones matemáticas y los elementos de la estructura.

La arquitectura aprobada es híbrida y local-first: el modelado y los cálculos iniciales funcionarán localmente; las cuentas, sincronización, almacenamiento remoto y colaboración se dejarán para una etapa posterior.

La propuesta tecnológica es React + TypeScript estricto + Vite + SVG, con separación entre dominio, geometría, aplicación, modelador e infraestructura. Se contemplan Vitest, Playwright, IndexedDB y JSON, además de publicación inicial mediante GitHub Pages.

El proyecto se divide en tres hitos:

- Hito 1: lienzo, geometría, coordenadas, nudos, barras y selección.
- Hito 2: apoyos, cargas y edición estructural.
- Hito 3: persistencia, importación/exportación y publicación.

Actualmente se estaba trabajando en el Hito 1. Se solicitaron dos mejoras adicionales: Grid Snap/Object Snap y selección múltiple.

Decisiones técnicas importantes:
- Los cruces entre barras no crean nudos automáticamente.
- Las conexiones deben ser explícitas.
- Las cargas sobre barras deben guardar su distancia física desde el inicio.
- El UCS no debe modificar la geometría global.
- Las unidades internas son m, N, N·m y rad.
- X positivo a la derecha, Y positivo hacia arriba y rotaciones positivas antihorarias.
- El ajuste a cuadrícula debe utilizar incrementos físicos configurables.
- Object Snap debe tener prioridad sobre Grid Snap.
- La selección múltiple debe distinguir ventanas de izquierda a derecha y de derecha a izquierda.
- El proyecto debe modificarse incrementalmente, sin reconstrucciones innecesarias.

**Siguiente acción:** inspeccionar el estado real del código en la carpeta del proyecto, verificar qué partes del Hito 1 están implementadas y completar las funcionalidades de Snap y selección múltiple antes de pasar al Hito 2.

La nueva conversación debe utilizar este documento como contexto principal y continuar desde el estado real del código, sin volver a diseñar desde cero lo que ya está decidido.
