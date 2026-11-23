import type { ReactNode } from 'react'

export { formatCalculation as resultNumber } from '../../modeler/format'

export function ResultTable({ label, headings, rows }: {
  label: string
  headings: readonly string[]
  rows: readonly { id: string; cells: readonly ReactNode[] }[]
}) {
  return <div className="result-table-wrap">
    <table className="result-table" aria-label={label}>
      <thead><tr>{headings.map(item => <th scope="col" key={item}>{item}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        {row.cells.map((value, index) => index === 0
          ? <th key={index} scope="row">{value}</th> : <td key={index}>{value}</td>)}
      </tr>)}</tbody>
    </table>
  </div>
}
