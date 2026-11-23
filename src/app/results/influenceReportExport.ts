export type ReportPaper = 'a4' | 'a3'
export type ReportOrientation = 'landscape' | 'portrait'
export type ReportFormat = 'pdf' | 'svg' | 'png'

export function paperSize(paper: ReportPaper, orientation: ReportOrientation) {
  const [short, long] = paper === 'a4' ? [210, 297] : [297, 420]
  const [width, height] = orientation === 'landscape' ? [long, short] : [short, long]
  return { widthMM: width, heightMM: height, width: width * 3.2, height: height * 3.2 }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function exportInfluenceReport(pages: readonly SVGSVGElement[], paper: ReportPaper,
  orientation: ReportOrientation, format: ReportFormat, signal: AbortSignal) {
  if (!pages.length) return
  const { width, height, widthMM, heightMM } = paperSize(paper, orientation)
  const name = 'aula-estructural-lineas-de-influencia'
  const snapshot = pages.map(page => page.cloneNode(true) as SVGSVGElement)
  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf')
    await import('svg2pdf.js')
    const doc = new jsPDF({ format: paper, orientation, unit: 'mm', compress: true, putOnlyUsedFonts: true })
    for (const [i, page] of snapshot.entries()) {
      signal.throwIfAborted()
      if (i) doc.addPage(paper, orientation)
      await doc.svg(page, { x: 0, y: 0, width: widthMM, height: heightMM })
    }
    signal.throwIfAborted()
    download(doc.output('blob'), `${name}.pdf`)
    return
  }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height * snapshot.length}`)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height * snapshot.length))
  snapshot.forEach((page, i) => {
    page.setAttribute('x', '0')
    page.setAttribute('y', String(height * i))
    page.setAttribute('width', String(width))
    page.setAttribute('height', String(height))
    svg.append(page)
  })
  const source = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' })
  if (format === 'svg') { download(source, `${name}.svg`); return }
  const url = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    signal.throwIfAborted()
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * 2)
    canvas.height = Math.ceil(height * snapshot.length * 2)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('El navegador no pudo rasterizar el reporte.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('No se pudo generar el PNG.')
    signal.throwIfAborted()
    download(png, `${name}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}
