import type { ReactNode } from 'react'

export function AcademicHelp({ title, children }: { title: string; children: ReactNode }) {
  return <details className="academic-help">
    <summary>{title}</summary>
    {children}
  </details>
}

export function ProjectHelp() {
  return <>
    <AcademicHelp title="Guía rápida">
      <ol>
        <li>Dibuja nudos y barras con el ratón o introduce coordenadas exactas en el Inspector.</li>
        <li>Asigna apoyos a los nudos según los movimientos que deban restringirse.</li>
        <li>Aplica fuerzas, momentos o cargas de barra y confirma sus magnitudes y direcciones.</li>
        <li>Selecciona las barras y asigna material, sección y eje de flexión, o introduce E, A e I.</li>
        <li>Pulsa <strong>Analizar estructura</strong> y revisa los desplazamientos y las reacciones.</li>
        <li>Usa <strong>AVM</strong> para consultar esfuerzos y deformadas sobre el modelo.</li>
        <li>Activa <strong>Aprender</strong> y abre <strong>Desarrollo</strong> para seguir el cálculo matricial.</li>
        <li>Guarda el proyecto en el navegador y exporta un JSON como respaldo.</li>
      </ol>
    </AcademicHelp>
    <AcademicHelp title="Aviso de Beta 0.2">
      <p>Aplicación educativa en desarrollo. Verifica los resultados de forma independiente. Se prohíbe utilizar esta beta como única base para decisiones reales de ingeniería.</p>
      <p>Los proyectos se almacenan localmente en este navegador. Exporta respaldos JSON para conservarlos fuera del navegador.</p>
    </AcademicHelp>
  </>
}
