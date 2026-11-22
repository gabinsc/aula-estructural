# Publicación de Aula Estructural · Beta 0.2

La segunda beta incluye los métodos académicos del Hito 7, su auditoría matemática y las consultas elásticas nominales del Hito 8.1. Su etiqueta de despliegue es `v0.2.0-beta.2` y usa el sitio existente. El primer candidato detectó un desborde de la barra en Chromium para Linux y quedó sin desplegar. [Aula Estructural](https://gabinsc.github.io/aula-estructural/) · [Alcance de diseño](HITO_8_1_DESIGN_FOUNDATIONS.md)

## Primera publicación

1. En la cuenta u organización elegida, crea un repositorio público vacío llamado **aula-estructural**. Déjalo sin README, licencia ni .gitignore iniciales.
2. Una vez autorizada la conexión, ejecuta estos comandos desde el repositorio local. Sustituye `PROPIETARIO` por la cuenta u organización de destino. La rama `beta-publica` contiene el primer commit preparado para compartir, con historial independiente. Elige **main** como rama predeterminada en GitHub.

   ```sh
   git remote add origin https://github.com/PROPIETARIO/aula-estructural.git
   git push origin refs/heads/beta-publica:refs/heads/main
   git push origin refs/tags/v0.1.0-beta.1
   ```

3. En **Settings → Pages**, elige **GitHub Actions** como **Source**. En **Settings → Environments → github-pages**, limita los despliegues a `main` si configuras una regla de ramas.
4. Abre **Actions → Publicar estático en GitHub Pages → Run workflow**, selecciona `main` y pulsa **Run workflow**. El flujo instala desde el lockfile, ejecuta Vitest, TypeScript y Playwright en Chromium, y publica el artefacto de `dist/` si pasan las verificaciones. La URL figura en el entorno del trabajo de despliegue. [Configuración de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [Flujos personalizados](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
5. Abre `https://PROPIETARIO.github.io/aula-estructural/` y comprueba la etiqueta de la beta, el análisis de un modelo, la exportación JSON y la recuperación del proyecto al recargar.

## Actualizar y reponer la versión anterior

Para continuar después de publicar, trabaja sobre la rama `main` de un clon del repositorio público. Integra cada versión probada en esa rama, etiqueta el commit que vas a publicar y ejecuta de nuevo el mismo flujo para `main`. Conserva el mismo propietario, repositorio, origen HTTPS y base `/aula-estructural/` durante la beta y la versión final.

Si una actualización defectuosa se integró como un único commit de publicación, desde ese clon ejecuta los siguientes comandos con su SHA. Si `main` está protegida, integra el revert mediante una pull request. Una vez integrado, vuelve a ejecutar el flujo manual sobre `main` y verifica la misma URL. Para una actualización con varios commits, prepara una sola reversión que restaure los archivos de la última etiqueta publicada. La primera publicación carece de una versión anterior en Pages.

```sh
git switch main
git pull --ff-only origin main
git revert SHA_DE_LA_ACTUALIZACION
git push origin main
```

## Proyectos guardados

Beta 0.2 conserva el origen y los almacenes de IndexedDB. Lee los esquemas JSON 1, 2 y 3 y escribe v4 al guardar, conservando identificadores y propiedades existentes. JSON v4 añade las resistencias declaradas y los criterios de diseño. Para llevar proyectos desde localhost, otro navegador u otro origen, utiliza **Proyectos → Exportar JSON** y después **Importar JSON** en el destino.

Beta 0.1 conserva intactos los registros v4 que encuentre, pero requiere un lector v4 para abrirlos. Si hay que reponer la interfaz anterior después de que usuarios hayan guardado en v4, prepara una versión de recuperación con el lector v4 antes de volver a publicar.

## Alcance de la revisión pública

La rama pública parte de una copia revisada del proyecto con un commit raíz y una identidad genérica. Se sustituyeron dos rutas locales en la copia pública del documento maestro. Las referencias privadas y la documentación original se conservan en el historial local. Para la conexión inicial, utiliza las referencias exactas indicadas arriba.
