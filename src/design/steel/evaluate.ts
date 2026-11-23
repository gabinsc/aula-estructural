import type { Section } from '../../domain/library'
import type { DesignResult } from '../contracts'
import type { SteelDemandDeclaration, SteelDesignResult, SteelLimitState, SteelMemberSettings, SteelUnit } from './contracts'
import { effectiveArea, flexuralBuckling, positive, webShear } from './e090'

type Resistance = Pick<SteelLimitState, 'nominal' | 'factor' | 'capacity' | 'equation' | 'substitution'>
type Inputs = {
  readonly section?: Section
  readonly E?: number
  readonly settings: SteelMemberSettings
  readonly demand?: SteelDemandDeclaration
}
const short = (value: number) => value.toPrecision(6)

export function steelDesign(design: DesignResult, { section, E, settings, demand }: Inputs): SteelDesignResult {
  const { designCase, material, area: Ag, actions } = design
  const { grade, method } = settings
  const flexureAxis = design.section?.axis
  const states: SteelLimitState[] = []
  const output = { designCase, grade, method, flexureAxis, states }
  if (!actions || settings.barId !== designCase.barId) return { ...output, partial: true, states: [{
    id: 'analysis', title: 'Acciones del análisis', source: '§1.4 y §1.5.3', applicable: true, state: 'stale',
    diagnostic: 'Ejecuta el análisis vigente para esta barra y estación.',
  }] }

  const compatible = demand?.analysisRevision === designCase.analysisRevision && demand.caseId === designCase.loadCaseId &&
    Boolean(demand.combination.trim()) && (method === 'LRFD' ? demand.kind === 'lrfd-combination' : demand.kind === 'asd-combination')
  const demandIssue = method === 'LRFD' ? 'Declara una combinación factorizada LRFD para esta revisión.'
    : 'Declara la combinación compatible ASD para esta revisión.'
  const Fy = grade ? material?.fy : undefined
  const Fu = grade ? material?.fu : undefined
  const missingMaterial = 'Indica el grado de acero y guarda la resistencia explícita del material vinculado.'
  const Nt = Math.max(0, actions.N), Nc = Math.max(0, -actions.N)
  const M = Math.abs(actions.M ?? 0), V = Math.abs(actions.V ?? 0)

  function row(id: string, title: string, source: string, action: number, unit: SteelUnit,
    resistance?: Resistance, diagnostic?: string, outside = false) {
    const capacity = resistance?.capacity
    const applicable = action > 0
    const ratio = applicable && compatible && positive(capacity) && !diagnostic ? action / capacity : undefined
    const state = ratio !== undefined ? ratio <= 1 ? 'pass' : 'fail' : outside ? 'outside' : 'pending'
    states.push({ ...resistance, id, title, source, unit, applicable, demand: action, ratio, state,
      diagnostic: diagnostic ?? (!applicable ? 'Sin demanda de este tipo en la estación.'
        : !compatible ? demandIssue : !positive(capacity) ? 'Resistencia no representable o datos insuficientes.' : undefined) })
    return ratio === undefined && diagnostic ? undefined : positive(capacity) && !diagnostic ? capacity : undefined
  }

  function scaled(nominal: number, factor: number, equation: string, substitution: string): Resistance | undefined {
    const capacity = nominal * factor
    return positive(nominal) && positive(capacity)
      ? { ...(method === 'LRFD' && { nominal }), factor, capacity, equation, substitution } : undefined
  }

  const gross = positive(Fy) && positive(Ag) ? scaled(Fy * Ag, method === 'LRFD' ? .9 : .6,
    method === 'LRFD' ? 'Pn = Fy·Ag' : 'Pa = 0,60Fy·Ag',
    `Fy = ${short(Fy / 1e6)} MPa, Ag = ${short(Ag)} m²`) : undefined
  const grossCapacity = row('tension-yield', 'Fluencia en área bruta', method === 'LRFD' ? '§4.1.1(a), ec. 4.1-1' : '§4.1.2',
    Nt, 'N', gross, gross ? undefined : missingMaterial)
  let net: Resistance | undefined
  let netIssue = 'No evaluado por información insuficiente. Declara An y la transferencia de la conexión.'
  let netSource = '§2.2, §2.3 y §4.1'
  let Ae: number | undefined
  if (positive(Ag) && settings.connection && positive(Fu) && (!positive(Fy) || Fu >= Fy)) {
    try {
      const values = effectiveArea(Ag, settings.connection)
      Ae = values.Ae
      net = scaled(Fu * Ae, method === 'LRFD' ? .75 : .5,
        method === 'LRFD' ? 'Ae = U·An · Pn = Fu·Ae' : 'Ae = U·An · Pa = 0,50Fu·Ae',
        `U = ${short(values.U)}, Ae = ${short(Ae)} m², Fu = ${short(Fu / 1e6)} MPa`)
      netSource = `${values.source} · ${method === 'LRFD' ? '§4.1.1(b), ec. 4.1-2' : '§4.1.2'}`
    } catch (error) { netIssue = error instanceof Error ? error.message : netIssue }
  } else if (positive(Fu) && positive(Fy) && Fu < Fy) netIssue = 'Revisa el material. Fu es menor que Fy.'
  const netCapacity = row('tension-rupture', 'Fractura en área neta efectiva', netSource, Nt, 'N', net, net ? undefined : netIssue)

  const rectangle = section?.geometry.kind === 'rectangle' ? section.geometry.dimensions : undefined
  const profile = section?.geometry.kind === 'I' && settings.weldedI ? section.geometry.dimensions : undefined
  const geometry = section && positive(Ag) && section.values.A === Ag ? section.values : undefined
  const fyRoot = positive(Fy) ? Math.sqrt(Fy / 1e6) : undefined
  const clear = profile ? profile.h! - 2 * profile.tf! : 0
  const web = profile ? clear / profile.tw! : 0
  const flange = profile ? profile.b! / (2 * profile.tf!) : 0
  const kc = Math.max(.35, Math.min(.763, 4 / Math.sqrt(web)))
  const nonSlender = rectangle || (profile && fyRoot && flange < 285 * Math.sqrt(kc) / fyRoot && web < 665 / fyRoot)
  const compact = rectangle || (profile && fyRoot && flange <= 170 / fyRoot && web <= 665 / fyRoot)
  if (actions.M !== undefined || Nc > 0) {
    states.push({ id: 'local', title: 'Clasificación local', source: '§2.5.1 y tabla 2.5.1', state: compact ? 'pass' : 'pending',
      applicable: Nc > 0 || M > 0,
      diagnostic: rectangle ? 'Sección maciza sin placas delgadas.' : compact
        ? `I soldada, ala b/t = ${short(flange)}, alma h/tw = ${short(web)}. Filtro compacto conservador para alma.`
        : 'Verificación incompleta. Geometría o relaciones ancho/espesor fuera de los criterios implementados.' })
  }

  const column = (axis: 'x' | 'y') => {
    const label = `Pandeo flexional respecto de ${axis}`
    const restraint = settings[axis]
    if (!restraint || !positive(restraint.k) || !positive(restraint.length) || !restraint.ends.trim()) {
      return row(`buckling-${axis}`, label, '§3.2 y §5.2', Nc, 'N', undefined, `Declara longitud, K y condiciones de extremo para el eje ${axis}.`)
    }
    if (!geometry || !nonSlender || !positive(E) || !positive(Fy) || !positive(Ag)) {
      return row(`buckling-${axis}`, label, '§5.2 y tabla 2.5.1', Nc, 'N', undefined,
        'Se requieren E, Fy, geometría y sección no esbelta dentro del alcance.', !!section && !nonSlender)
    }
    try {
      const result = flexuralBuckling(E, Fy, Ag, axis === 'x' ? geometry.Ixx : geometry.Iyy, restraint, method)
      return row(`buckling-${axis}`, label, result.source, Nc, 'N', result, !positive(result.capacity) ? 'Resistencia no representable.' : undefined)
    } catch (error) {
      return row(`buckling-${axis}`, label, '§5.2', Nc, 'N', undefined, error instanceof Error ? error.message : 'Esbeltez inválida.')
    }
  }
  const cx = column('x'), cy = column('y')
  if (Nc > 0 && profile) states.push({ id: 'torsion-column', title: 'Pandeo torsional o flexotorsional', source: '§5.3',
    state: 'outside', applicable: true, diagnostic: 'Modo de estabilidad adicional sin verificación en este incremento.' })

  let flexureCapacity: number | undefined
  if (actions.M !== undefined) {
    const S = design.section && Math.min(design.section.positive.S, design.section.negative.S)
    const major = geometry && flexureAxis && (flexureAxis === 'x' ? geometry.Ixx > geometry.Iyy : geometry.Iyy > geometry.Ixx)
    let flexure: Resistance | undefined
    let Lp: number | undefined
    if (positive(S) && positive(Fy) && settings.flexureRestrained && geometry && compact) {
      if (method === 'LRFD' && (rectangle || profile)) {
        const Z = rectangle ? flexureAxis === 'x' ? rectangle.b! * rectangle.h! ** 2 / 4 : rectangle.h! * rectangle.b! ** 2 / 4
          : flexureAxis === 'x' ? profile!.b! * profile!.tf! * (profile!.h! - profile!.tf!) + profile!.tw! * clear ** 2 / 4
            : (2 * profile!.tf! * profile!.b! ** 2 + clear * profile!.tw! ** 2) / 4
        flexure = scaled(Fy * Math.min(Z, 1.5 * S), .9, 'Mn = min(Fy·Z, 1,5Fy·S)',
          `Z = ${short(Z)} m³, S = ${short(S)} m³, eje ${flexureAxis}`)
        if (profile && major) Lp = 788 * Math.sqrt(Math.min(geometry.Ixx, geometry.Iyy) / geometry.A) / fyRoot!
      } else if (method === 'ASD' && rectangle && !major) {
        flexure = scaled(Fy * S, .75, 'Ma = 0,75Fy·S', `S = ${short(S)} m³, eje ${flexureAxis}`)
      }
    }
    const yieldCapacity = row('flexure-yield', 'Fluencia por flexión', method === 'LRFD' ? '§6.1.1.1, ec. 6.1-1' : '§6.1.2.2a, ec. 6.1-27',
      M, 'N·m', flexure, flexure ? undefined : 'Verificación incompleta. Sección, eje o hipótesis de flexión fuera de los casos admitidos.')
    const braced = !major || (positive(Lp) && positive(settings.lateralLength) && settings.lateralLength <= Lp)
    if (major) {
      states.push({ id: 'ltb', title: 'Pandeo lateral-torsional', source: '§6.1.1 y §6.1.1.2a, ec. 6.1-4',
        applicable: M > 0, state: braced && yieldCapacity !== undefined ? 'pass' : 'pending',
        equation: positive(Lp) ? 'Lp = 788 ry / √Fy(MPa)' : undefined,
        substitution: positive(Lp) ? `Lp = ${short(Lp)} m` : undefined,
        diagnostic: braced && yieldCapacity !== undefined ? 'Lb ≤ Lp confirmado. Gobierna la fluencia en el alcance de §6.1.1.'
          : 'Verificación incompleta. Indica Lb verificable. Fuera de la rama Lb ≤ Lp se requieren parámetros de torsión y alabeo.' })
    }
    flexureCapacity = braced ? yieldCapacity : undefined

    const shear = profile && settings.unreinforcedWeb && geometry && geometry.Ixx >= geometry.Iyy && flexureAxis === 'x' && positive(Fy)
      ? webShear(Fy, profile.h!, clear, profile.tw!, method) : undefined
    row('shear', 'Cortante en el plano del alma', shear?.source ?? '§6.2', V, 'N', shear,
      shear ? undefined : 'Se admite perfil I soldado homogéneo con alma sin rigidizadores y eje mayor x en los intervalos implementados.', !shear)
  }

  if (M > 0 && (Nt > 0 || Nc > 0)) {
    const axialCapacity = Nt > 0 ? grossCapacity && netCapacity && Math.min(grossCapacity, netCapacity)
      : cx && cy && rectangle && Math.min(cx, cy)
    const axialRatio = positive(axialCapacity) ? Math.abs(actions.N) / axialCapacity : undefined
    const momentRatio = positive(flexureCapacity) ? M / flexureCapacity : undefined
    const source = method === 'LRFD' ? `§8.1.1.${Nt > 0 ? 1 : 2}` : `§8.1.2.${Nt > 0 ? 1 : 2}`
    if (!compatible || axialRatio === undefined || momentRatio === undefined || (Nc > 0 && !demand?.secondOrder) ||
      (method === 'ASD' && Nc > 0 && axialRatio > .15)) {
      states.push({ id: 'interaction', title: 'Interacción axial–flexión', source, applicable: true, state: 'pending',
        diagnostic: !compatible ? demandIssue : 'Verificación incompleta. Se requieren resistencias individuales completas y, en compresión, acciones de §3.1. ASD se limita a fa/Fa ≤ 0,15.' })
    } else {
      const high = axialRatio >= .2
      const ratio = method === 'ASD' ? axialRatio + momentRatio : high ? axialRatio + 8 / 9 * momentRatio : axialRatio / 2 + momentRatio
      const equation = method === 'ASD' ? 'P/Pa + M/Ma ≤ 1' : high ? 'Pu/Pd + (8/9)·Mu/Md ≤ 1' : 'Pu/(2Pd) + Mu/Md ≤ 1'
      const reference = method === 'ASD' ? Nt > 0 ? '8.1-2a' : '8.1-2d' : high ? '8.1-1a' : '8.1-1b'
      states.push({ id: 'interaction', title: 'Interacción axial–flexión', source: `${source}, ec. ${reference}`,
        applicable: true, state: ratio <= 1 ? 'pass' : 'fail', capacity: 1, demand: ratio, ratio, equation,
        substitution: `Axial = ${short(axialRatio)}, flexión = ${short(momentRatio)}` })
    }
  }
  states.push({ id: 'extent', title: 'Alcance de la verificación', source: '§1.5.2, §2.4, cap. 10 y cap. 11',
    applicable: true, state: 'outside', diagnostic: 'Consulta de una estación. Conexiones, estabilidad del sistema, cargas concentradas y fatiga requieren verificaciones separadas.' })
  const governing = states.reduce<SteelLimitState | undefined>((current, item) =>
    item.ratio !== undefined && (!current || item.ratio > current.ratio!) ? item : current, undefined)
  return { ...output, effectiveArea: Ae, governing, partial: states.some(item => item.applicable && (item.state === 'pending' || item.state === 'outside')) }
}
