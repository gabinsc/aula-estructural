import { useMemo, useState } from 'react'
import { calculateSection, LENGTH_MM, SECTION_FIELDS } from '../../geometry/sections'
import type { ParametricSection, Primitive, SectionGeometry, SectionProperties } from '../../geometry/sections'
import type { LibraryEdit, Section } from '../../domain/library'
import { SectionPreview } from './SectionPreview'
import { decimal } from './fields'

const NAMES: Record<SectionGeometry['kind'], string> = { rectangle: 'Rectangular maciza', circle: 'Circular maciza',
  roundTube: 'Tubular circular', boxTube: 'Tubular rectangular', I: 'Perfil I', T: 'Perfil T', L: 'Perfil L', C: 'Canal C',
  compound: 'Compuesta', manual: 'Propiedades manuales' }
const LABELS: Record<string, string> = { b: 'Ancho b', h: 'Altura h', d: 'Diámetro exterior d', t: 'Espesor t',
  tw: 'Espesor del alma tw', tf: 'Espesor del ala tf', x: 'X', y: 'Y', r: 'Radio r' }
const MANUAL = [
  ['A', 'Área A (cm²)', 1e-4], ['cx', 'Centroide X (mm)', LENGTH_MM], ['cy', 'Centroide Y (mm)', LENGTH_MM],
  ['Ixx', 'Ixx (cm⁴)', 1e-8], ['Iyy', 'Iyy (cm⁴)', 1e-8], ['Ixy', 'Ixy (cm⁴)', 1e-8],
] as const

function asText(value: number | undefined, unit = LENGTH_MM) {
  return value === undefined ? '' : String(value / unit)
}

function physical(text: string, unit: number, original?: number) {
  return original !== undefined && asText(original, unit) === text ? original : decimal(text) * unit
}

type PartDraft = { id: number; kind: Primitive['kind']; hole: boolean; values: Record<string, string>; original?: Primitive }
function partFields(kind: Primitive['kind']) { return kind === 'rect' ? ['x', 'y', 'b', 'h'] : ['x', 'y', 'r'] }

function NumericField({ label, text, onChange }: { label: string; text: string; onChange: (value: string) => void }) {
  return <label>{label}<input inputMode="decimal" value={text} onChange={event => onChange(event.target.value)} /></label>
}

function PartEditor({ part, index, update, remove }: {
  part: PartDraft; index: number; update: (part: PartDraft) => void; remove: () => void
}) {
  return <fieldset className="library-fields section-part">
    <legend>Región {index + 1} · {part.kind === 'disk' ? 'Círculo' : 'Rectángulo'}</legend>
    <div className="library-field-grid">
      {partFields(part.kind).map(key => <NumericField key={key} label={`${LABELS[key]} (mm) · región ${index + 1}`}
        text={part.values[key] ?? ''} onChange={value => update({ ...part, values: { ...part.values, [key]: value } })} />)}
    </div>
    <div className="library-actions"><label className="library-check"><input type="checkbox" checked={part.hole}
      onChange={event => update({ ...part, hole: event.target.checked })} />Vacío interior</label>
      <button type="button" className="button secondary" onClick={remove}>Quitar región {index + 1}</button></div>
  </fieldset>
}

export function SectionEditor({ section, linked, edit, select }: {
  section?: Section; linked: number; edit: (change: LibraryEdit) => void; select: (id: string) => void
}) {
  const previous = section?.geometry
  const [name, setName] = useState(section?.name ?? '')
  const [kind, setKind] = useState<SectionGeometry['kind']>(previous?.kind ?? 'rectangle')
  const [dimensions, setDimensions] = useState<Record<string, string>>(() => previous && 'dimensions' in previous
    ? Object.fromEntries(Object.entries(previous.dimensions).map(([key, value]) => [key, asText(value)])) : {})
  const [manual, setManual] = useState<Record<string, string>>(() => previous?.kind === 'manual'
    ? Object.fromEntries(MANUAL.map(([key, , unit]) => [key, asText(previous.values[key], unit)])) : {})
  const [parts, setParts] = useState<PartDraft[]>(() => previous?.kind === 'compound' ? previous.parts.map((p, id) => ({
    id, kind: p.kind, hole: !!p.hole, original: p, values: {
      x: asText(p.x), y: asText(p.y), ...(p.kind === 'rect' ? { b: asText(p.b), h: asText(p.h) } : { r: asText(p.r) }),
    },
  })) : [])
  const [sequence, setSequence] = useState(parts.length)
  const [update, setUpdate] = useState(false)
  const [error, setError] = useState('')
  const preview = useMemo(() => {
    let geometry: SectionGeometry
    if (kind === 'manual') {
      const fields = Object.fromEntries(MANUAL.map(([key, , unit]) =>
        [key, physical(manual[key] ?? '', unit, previous?.kind === 'manual' ? previous.values[key] : undefined)]))
      geometry = { kind, values: fields as SectionProperties }
    } else if (kind === 'compound') {
      geometry = { kind, parts: parts.map(({ kind, hole, values, original }): Primitive => {
        const base = { x: physical(values.x ?? '', LENGTH_MM, original?.x), y: physical(values.y ?? '', LENGTH_MM, original?.y),
          ...(hole ? { hole: true } : {}) }
        return kind === 'rect' ? { ...base, kind, b: physical(values.b ?? '', LENGTH_MM, original?.kind === 'rect' ? original.b : undefined),
          h: physical(values.h ?? '', LENGTH_MM, original?.kind === 'rect' ? original.h : undefined) }
          : { ...base, kind, r: physical(values.r ?? '', LENGTH_MM, original?.kind === 'disk' ? original.r : undefined) }
      }) }
    } else {
      const prior = previous && 'dimensions' in previous && previous.kind === kind ? previous.dimensions : undefined
      geometry = { kind, dimensions: Object.fromEntries(SECTION_FIELDS[kind].map(key =>
        [key, physical(dimensions[key] ?? '', LENGTH_MM, prior?.[key])])) }
    }
    try { return { geometry, calculated: calculateSection(geometry) } }
    catch (cause) { return { geometry, issue: (cause as Error).message } }
  }, [kind, dimensions, manual, parts, previous])

  function add(kind: Primitive['kind']) {
    setParts([...parts, { id: sequence, kind, hole: false, values: { x: '0', y: '0' } }])
    setSequence(sequence + 1)
  }

  return <form className="precision-form library-form" noValidate onSubmit={event => {
    event.preventDefault()
    const label = name.trim()
    const issue = !label || label.length > 80 ? 'Introduce un nombre de sección válido.' : preview.issue
    setError(issue ?? '')
    if (issue) return
    const id = section?.id ?? crypto.randomUUID()
    edit({ type: 'save-section', id, name: label, geometry: preview.geometry, updateLinked: update })
    select(id)
  }}>
    <div className="library-field-grid">
      <label>Nombre de la sección<input value={name} onChange={event => setName(event.target.value)} /></label>
      <label>Tipo geométrico<select value={kind} onChange={event => { setKind(event.target.value as SectionGeometry['kind']); setError('') }}>
        {Object.entries(NAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
    </div>
    <div className="section-editor-grid">
      <div className="section-fields">
        {kind === 'compound' ? <>
          <p className="field-help">Rectángulos por esquina inferior izquierda. Círculos por centro. Los vacíos deben quedar dentro de un solo sólido.</p>
          <div className="library-actions">
            <button type="button" className="button secondary" disabled={parts.length >= 100} onClick={() => add('rect')}>Agregar rectángulo</button>
            <button type="button" className="button secondary" disabled={parts.length >= 100} onClick={() => add('disk')}>Agregar círculo</button>
          </div>
          {parts.map((part, i) => <PartEditor key={part.id} part={part} index={i}
            update={next => setParts(parts.map(item => item.id === part.id ? next : item))}
            remove={() => setParts(parts.filter(item => item.id !== part.id))} />)}
        </> : <div className="library-field-grid">
          {kind === 'manual' ? MANUAL.map(([key, label]) => <NumericField key={key} label={label} text={manual[key] ?? ''}
            onChange={value => setManual({ ...manual, [key]: value })} />)
            : SECTION_FIELDS[kind as ParametricSection].map(key => <NumericField key={key} label={`${LABELS[key]} (mm)`}
              text={dimensions[key] ?? ''} onChange={value => setDimensions({ ...dimensions, [key]: value })} />)}
        </div>}
      </div>
      {preview.calculated ? <SectionPreview section={preview.calculated} /> : <p className="section-placeholder">{preview.issue}</p>}
    </div>
    {linked > 0 && <label className="library-check"><input type="checkbox" checked={update}
      onChange={event => setUpdate(event.target.checked)} />Actualizar las {linked} barras vinculadas al confirmar</label>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="submit" className="button primary">Guardar sección</button>
  </form>
}
