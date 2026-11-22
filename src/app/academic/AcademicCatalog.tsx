import { useState } from 'react'
import { ACADEMIC_EXAMPLES, displayAcademicReference } from '../../projects/academicExamples'
import type { AcademicExample } from '../../projects/academicExamples'

export function AcademicCatalog({ busy, openCopy }: {
  busy: boolean
  openCopy: (example: AcademicExample) => void
}) {
  const [example, select] = useState(ACADEMIC_EXAMPLES[0]!)
  return <section className="academic-catalog" aria-labelledby="academic-heading">
    <h3 id="academic-heading">Ejemplos académicos</h3>
    <div className="academic-layout">
      <ul className="academic-choices" aria-label="Ejercicios">
        {ACADEMIC_EXAMPLES.map(item => <li key={item.id}>
          <button type="button" className="button secondary" disabled={busy} aria-pressed={item === example}
            onClick={() => select(item)}>{item.title}</button>
        </li>)}
      </ul>
      <section className="academic-exercise" aria-labelledby="academic-title">
        <h4 id="academic-title">{example.title}</h4>
        <p>{example.description}</p>
        <p>{example.task}</p>
        <details className="academic-help">
          <summary>Resultados de referencia</summary>
          <p>{example.derivation}</p>
          <dl>{example.references.map(item => <div key={item.label}>
            <dt>{item.label}</dt><dd>{displayAcademicReference(item)}</dd>
          </div>)}</dl>
        </details>
        <button type="button" className="button primary" disabled={busy}
          onClick={() => openCopy(example)}>Abrir copia editable</button>
      </section>
    </div>
  </section>
}
