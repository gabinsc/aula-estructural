# Hito 2 · Aceptación integral

**Dictamen · APTO CON OBSERVACIONES.** Los controles de integridad, equivalencia física, transacciones, tipos y producción pasaron. Las limitaciones de presentación y precisión documentadas permiten avanzar al Hito 3.

Se cotejaron el [documento maestro, §§5.2 y 6.1–6.5](requisitos/DOCUMENTO_MAESTRO_2026-11-21.md) y la [adenda, §1](requisitos/ADENDA_REQUISITOS_2026-11-21.md) con los incrementos implementados. La operación futura de crear una unión común en el cruce de varias barras, las herramientas educativas y el análisis estructural quedan fuera de este cierre.

| Requisito | Implementación y evidencia | Prueba | Resultado | Observación |
| --- | --- | --- | --- | --- |
| Identidad, unidades, conectividad y cruces | Nudos globales en metros, barras por IDs y unión explícita solo dentro de la barra dividida. | Vitest de dominio y estructura conectada en Playwright. | Conforme | Los nudos superpuestos siguen siendo independientes. |
| Historial con transacciones completas | Versiones inmutables con IDs y referencias preservados. | Vitest de historial y Playwright con borrados, pegado, división e inversión. | Conforme | Pilas por sesión. |
| Apoyos articulado, rodillo y empotrado | Apoyos por ID, restricciones globales y sustitución confirmada. | Vitest de restricciones y Playwright con los tres tipos, rodillo girado y UCS. | Conforme | Símbolos coincidentes se distinguen desde el Inspector. |
| Cargas nodales, puntuales y distribuidas | Entidades con magnitudes SI, marco y distancias físicas. | Vitest de cargas y Playwright con fuerzas, momentos y perfiles. | Conforme | La etiqueta del símbolo puede solaparse en escenas densas. |
| Movimiento individual y múltiple | Traslación común y validación de la geometría final y las cargas. | Vitest de movimiento y Playwright de traslado y rechazo. | Conforme | El rechazo indica la barra y la carga. |
| Selección, edición y menús contextuales | Prioridad a nudo, carga y barra. Acciones según contexto y teclado. | Playwright con clic, modificadores, ventanas, menú y Escape. | Conforme | Alt + clic recorre cargas coincidentes. |
| Copiar y pegar | Remapeo de IDs y dependencias en una operación. | Vitest con cinco nudos, cuatro barras, apoyos y cargas. Playwright copia la estructura completa. | Conforme | La copia de cargas sin geometría usa un propietario explícito. |
| Dividir e invertir | Interpolación, transformación al partir, cambio de origen y signo al invertir. | Vitest de equivalencia física y Playwright que confirma y recupera. | Conforme | Con magnitudes o coordenadas extremas se rechaza la operación si la aritmética disponible no preserva la precisión necesaria. |
| Acotación, Snap y UCS | Cotas físicas derivadas y visibilidad independiente del historial. | Vitest de los tres tipos de orientación y Playwright con UCS girado, Snap y zoom. | Conforme | Se reducen etiquetas de barras en zonas densas. |
| Regresión de interfaz CAD | Inspector, barra inferior, ventanas y resoluciones estrechas. | Playwright sobre producción con escenario integrado sin excepciones de página. | Conforme | Entorno Edge para Windows. |

## Comprobación física y puerta de avance

El escenario integrado construye una cadena de cinco nudos y cuatro barras en dominio y navegador. Incorpora apoyos articulado y rodillo, fuerza nodal, carga puntual y perfiles uniforme y lineal. El empotramiento se verifica en su escenario independiente. Se comprueba copia completa, remapeo de relaciones, conversión al cortar, inversión y restauración. La regresión incluye movimiento individual y múltiple.

En el caso de 8 m con intensidades 10 y 30 kN/m, los extremos nuevos son 10 y 17,5 kN/m sobre 3 m, y 17,5 y 30 kN/m sobre 5 m. La integración matemática independiente de ambos segmentos conserva **160 kN** y **746,6666667 kN·m**. La inversión de una carga oblicua conserva su vector global dentro del redondeo trigonométrico. [Pruebas matemáticas](../src/domain/cadEdition.test.ts)

**Puerta de avance superada.** Vitest pasó 89 pruebas, Edge pasó 30 Playwright sobre producción y TypeScript terminó sin errores. [Implementación y capturas del Hito 2.4](HITO_2_4_CAD_EDITION.md)
