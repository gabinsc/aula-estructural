# Aula Estructural · Beta 0.1 · Hito 6

## Estado y condiciones

El incremento 6.3 se prepara localmente. La versión pública previa respondió HTTP 200 y su rama `main` apunta a `cf6b78d`; su árbol coincide con la base local de recuperación. La publicación del Hito 6 requiere autorización expresa. [Sitio establecido](https://gabinsc.github.io/aula-estructural/)

| Comprobación | Evidencia local |
| --- | --- |
| Identidad | **Beta 0.1** en la cabecera; aviso educativo visible y versión ampliada en **Proyectos → Aviso de Beta 0.1**. |
| Subruta | `base: '/aula-estructural/'`. Vite genera `dist/`; Playwright abre el HTML de producción en esa subruta y verifica CSS, SVG, Worker y un análisis con solución conocida. |
| Flujo | `workflow_dispatch`, Node 24, `npm ci`, Vitest, tipos, suite completa en Chromium con dos procesos, artefacto `dist/`, despliegue condicionado al éxito. |
| Datos | IndexedDB mantiene sus almacenes, JSON mantiene esquema 3 y lee esquemas 1 y 2. Los originales se conservan ante un esquema futuro no reconocido. La exportación sirve de respaldo y para trasladar proyectos entre orígenes. |
| Privacidad | Ejercicios sintéticos sin información personal, archivos del incremento revisados, credenciales, respaldos, dependencias y compilación excluidos del árbol publicable. |

[Resultados y capturas](HITO_6_FINAL_AUDIT.md) · [Flujo manual](../.github/workflows/pages.yml)

## Activación autorizada

La rama local `hito-6-beta` desciende de la copia local de la corrección móvil. Esa corrección se aplicó en GitHub mediante la API, por lo que el commit público tiene otro SHA aunque el árbol base coincida. Aplica el commit del Hito 6 como parche sobre una copia limpia de `main` público para conservar la historia.

En PowerShell, desde la raíz del proyecto vigente, genera el parche. Después clona en una carpeta hermana y aplícalo al `main` de GitHub.

```powershell
$parche = (git format-patch -1 hito-6-beta -o .qa.local | Select-Object -Last 1)
$parche = (Resolve-Path -LiteralPath $parche).Path
git clone https://github.com/gabinsc/aula-estructural.git ../aula-estructural-publicacion
Set-Location ../aula-estructural-publicacion
git switch main
git -c user.name="Aula Estructural" -c user.email="aula-estructural@example.invalid" am "$parche"
git status --short
```

Tras revisar el commit aplicado y contar con autorización, ejecuta `git push origin main`. Con **Settings → Pages → Source → GitHub Actions** seleccionado, abre **Actions → Publicar estático en GitHub Pages → Run workflow** y confirma `main`. Comprueba `build` y `deploy` y luego abre la URL pública. Como alternativa, con GitHub CLI autenticado ejecuta `gh workflow run pages.yml --repo gabinsc/aula-estructural --ref main`. [Guía oficial de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Para revertir, aplica `git revert SHA_DEL_HITO_6` en el clon público, sube esa reversión autorizada y ejecuta de nuevo el flujo de `main`. Conserva el propietario, repositorio, esquema compatible y subruta para mantener la URL y los proyectos locales. [Guía de primera publicación y recuperación](PUBLIC_BETA.md)
