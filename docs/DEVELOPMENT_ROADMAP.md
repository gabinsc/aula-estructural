# Hoja de ruta

## Fase 1 · Modelador CAD 2D

| Hito | Alcance |
| --- | --- |
| 1 · Geometría y cámara | Entorno SVG, cuadrícula, ejes, zoom, paneo y ajuste. Creación gráfica y numérica de nudos y barras, UCS, Grid Snap, Object Snap, selección y eliminación múltiple, traslado de nudos, inspector y aviso de superposición. |
| 2 · Edición estructural | Apoyos, cargas, menús contextuales, deshacer y rehacer (Undo/Redo) y edición avanzada, incluida la división de barras y copiar y pegar. |
| 3 · Proyectos y publicación | Persistencia local con IndexedDB y autoguardado, validación, importación y exportación JSON, y publicación. |

El Hito 2 integra historial, apoyos, cargas, menús contextuales, copia y pegado, división, inversión y cotas. El Hito 3 integra proyectos locales, autoguardado e intercambio JSON. La publicación estática queda preparada para ejecución manual autorizada. [Aceptación del Hito 2](HITO_2_FINAL_ACCEPTANCE.md) · [Aceptación del Hito 3](HITO_3_FINAL_ACCEPTANCE.md)

### Reglas para las operaciones futuras

- **Crear unión en intersección** será una acción explícita que crea el nudo compartido, divide las barras implicadas, conserva sus propiedades, actualiza referencias y se deshace en un paso.
- La edición de longitud conserva la distancia física de cada carga puntual y el intervalo físico de cada carga distribuida. Los movimientos que dejarían cargas fuera se rechazan de forma atómica.
- Al dividir una barra, las cargas se reasignan preservando su ubicación. Una puntual en el corte se convierte en una carga nodal equivalente.

## Fases posteriores

### Hito 4 · Análisis estructural

Los incrementos 4.1–4.3 aportan la formulación y el solucionador de armaduras y pórticos. Los incrementos 4.4 y 4.5 integran propiedades mecánicas, historial, JSON v2, vigencia del cálculo y resultados trazables. **Resolver** presenta valores y balances. **Aprender** añade matrices y recuperación de esfuerzos. [Aceptación de 4.4 y 4.5](HITO_4_4_4_5_INTEGRATION.md)

El Hito 4.6 incorpora diagramas individuales en el CAD, franjas AVM coordinadas y deformada. [Aceptación del Hito 4.6](HITO_4_6_AVM_DIAGRAMS.md)

### Hito 5.1 · Desarrollo educativo de rigideces

**Aprender** guía desde la conectividad hasta el equilibrio usando las matrices y resultados de un mismo análisis. **Resolver** conserva las tablas, los diagramas y los diagnósticos. [Desarrollo educativo](HITO_5_1_EDUCATIONAL_STIFFNESS.md)

### Ampliaciones previstas

Queda prevista una evaluación específica de estabilidad e isostaticidad. El almacenamiento remoto, la sincronización y los servicios de usuario se evaluarán en fases posteriores.

### Hitos 5.2 y 5.3 · Materiales y secciones

La biblioteca local conserva materiales, fuentes, secciones, predeterminados explícitos y vínculos por barra. El editor admite ocho familias paramétricas, composiciones validadas y propiedades manuales. JSON v3 mantiene E, A e I de los proyectos previos y permite asignaciones y sobrescrituras en lote. [Biblioteca](HITO_5_2_MATERIAL_LIBRARY.md) · [Editor](HITO_5_3_SECTION_EDITOR.md)

### Hito 6 · Estabilización y experiencia académica

El catálogo local ofrece seis ejercicios con referencias independientes y abre copias editables. La guía rápida y la ayuda contextual cubren el recorrido CAD–AVM–Aprender. Este incremento conserva el esquema JSON 3 y el flujo manual de Pages de Beta 0.1. [Auditoría](HITO_6_FINAL_AUDIT.md) · [Preparación de la publicación](HITO_6_BETA_RELEASE.md)

### Hitos 7.1 y 7.2 · Trabajo virtual y método de las fuerzas

Trabajo virtual integra productos de acciones internas reales y unitarias. El método de las fuerzas usa esas integrales para obtener la flexibilidad de las restricciones seleccionadas, resolver compatibilidad y recuperar resultados estructurales. Ambos procedimientos se ejecutan en el Worker con configuraciones de sesión. [Trabajo virtual](HITO_7_1_VIRTUAL_WORK.md) · [Método de las fuerzas](HITO_7_2_FORCE_METHOD.md)

### Hitos 7.3 y 7.4 · Influencia, trenes y Hardy Cross

Las líneas de influencia evalúan una respuesta fija al mover una unidad o un tren por un camino explícito. Los extremos se buscan por eventos y raíces interiores. Hardy Cross distribuye momentos y transportes por barridos para vigas y pórticos sin rotación apreciable de cuerda. [Líneas de influencia](HITO_7_3_INFLUENCE_LINES.md) · [Distribución de momentos](HITO_7_4_MOMENT_DISTRIBUTION.md)

### Hito 8.1 · Fundamentos de diseño estructural

El módulo independiente de Diseño consume esfuerzos vigentes y evalúa la tensión normal elástica por sección y por barra. Los parámetros resistentes declarados y los límites explícitos se guardan en JSON v4. Las próximas etapas de diseño podrán incorporar combinaciones y verificaciones normativas de acero y concreto. [Fundamentos y aceptación](HITO_8_1_DESIGN_FOUNDATIONS.md)

### Hito 8.2 · Verificaciones educativas de acero

El módulo aplica un subconjunto documentado de E.090 con LRFD y ASD separados. Calcula resistencias y compara demandas del caso vigente cuando existe una declaración compatible. JSON v5 añade los parámetros confirmados por barra. Quedan para incrementos posteriores las combinaciones automáticas, las ramas generales de pandeo y la comprobación integral de diseño. [Fórmulas, alcance y aceptación](HITO_8_2_STEEL_DESIGN.md)
