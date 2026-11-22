import { useState } from 'react'
import type { FormEvent } from 'react'
import { PA_PER_MPA } from '../../design/contracts'
import type { DesignCriterion, DesignMaterialProperties } from '../../design/contracts'
import { readDesignCriterion, readDesignMaterial } from '../../design/settings'
import type { Material } from '../../domain/library'
import { parseNumber } from '../../modeler/format'

export const ORIGIN_LABELS: Readonly<Record<DesignMaterialProperties['origin'], string>> = {
  illustrative: 'Ilustrativa',
  declared: 'Declarada por el usuario',
  'normative-verified': 'Fuente normativa verificada por el usuario',
}

const display = (value: number | undefined, unit: number) => value === undefined ? '' : String(value / unit)

function optionalMagnitude(form: FormData, key: string, unit: number) {
  const input = String(form.get(key) ?? '').trim()
  const value = parseNumber(input)
  return input ? (value ?? NaN) * unit : undefined
}

export function MaterialForm({ material, saved, update }: {
  material: Material
  saved?: DesignMaterialProperties
  update: (material: DesignMaterialProperties) => void
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      update(readDesignMaterial({ materialId: material.id, origin: form.get('origin'), source: form.get('source'),
        fy: optionalMagnitude(form, 'fy', PA_PER_MPA), fu: optionalMagnitude(form, 'fu', PA_PER_MPA),
        fc: optionalMagnitude(form, 'fc', PA_PER_MPA) }))
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Datos resistentes inválidos.') }
  }
  return <details className="result-detail">
    <summary>Editar resistencias del material</summary>
    <form onSubmit={submit} className="design-form">
      <label className="result-field">Procedencia resistente
        <select name="origin" defaultValue={saved?.origin ?? 'declared'}>
          {Object.entries(ORIGIN_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="result-field">Fuente resistente<input name="source" defaultValue={saved?.source ?? ''} maxLength={500}
        placeholder="Declaración o referencia verificable" required /></label>
      <div className="result-controls">
        <label className="result-field">fy (MPa)<input name="fy" inputMode="decimal" defaultValue={display(saved?.fy, PA_PER_MPA)} /></label>
        <label className="result-field">fu (MPa)<input name="fu" inputMode="decimal" defaultValue={display(saved?.fu, PA_PER_MPA)} /></label>
        <label className="result-field">Compresión del material (MPa)<input name="fc" inputMode="decimal" defaultValue={display(saved?.fc, PA_PER_MPA)} /></label>
      </div>
      <button type="submit" className="button secondary">Guardar resistencias</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>
}

export function CriterionForm({ saved, update }: { saved?: DesignCriterion; update: (criterion?: DesignCriterion) => void }) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const limit = optionalMagnitude(form, 'service', .001)
    try {
      const criterion = readDesignCriterion({ id: saved?.id ?? 'criterio-proyecto', name: form.get('name'),
        tension: optionalMagnitude(form, 'tension', PA_PER_MPA), compression: optionalMagnitude(form, 'compression', PA_PER_MPA),
        ...(limit !== undefined && { service: { reference: form.get('reference'), limit } }) })
      update(criterion)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Criterio inválido.') }
  }
  return <details className="result-detail">
    <summary>Editar criterio del proyecto</summary>
    <form onSubmit={submit} className="design-form">
      <label className="result-field">Nombre del criterio<input name="name" maxLength={80} defaultValue={saved?.name ?? ''} required /></label>
      <div className="result-controls">
        <label className="result-field">Límite de tracción (MPa)<input name="tension" inputMode="decimal" defaultValue={display(saved?.tension, PA_PER_MPA)} /></label>
        <label className="result-field">Límite de compresión (MPa)<input name="compression" inputMode="decimal" defaultValue={display(saved?.compression, PA_PER_MPA)} /></label>
      </div>
      <label className="result-field">Límite transversal en la estación (mm)<input name="service" inputMode="decimal"
        defaultValue={display(saved?.service?.limit, .001)} /></label>
      <label className="result-field">Referencia del desplazamiento<select name="reference" defaultValue={saved?.service?.reference ?? 'relative-chord'}>
        <option value="relative-chord">Flecha relativa a la cuerda de la barra</option>
        <option value="local-absolute">Desplazamiento absoluto en y local</option>
      </select></label>
      <div className="result-controls">
        <button type="submit" className="button secondary">Guardar criterio</button>
        {saved && <button type="button" className="button secondary" onClick={() => {
          update()
          setError('')
        }}>Quitar criterio</button>}
      </div>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>
}
