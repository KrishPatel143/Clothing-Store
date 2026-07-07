import { useState } from 'react';
import { cmToIn } from '../scan/units.js';

const DIMS = [
  ['shoulder', 'Shoulder'],
  ['chest', 'Chest'],
  ['waist', 'Waist'],
  ['hip', 'Hip'],
];

// Values are stored in cm; this table renders either unit.
export default function SizeChartTable({ sizeChart, highlightSize }) {
  const [unit, setUnit] = useState('in');
  if (!sizeChart?.length) return null;

  const shownDims = DIMS.filter(([key]) => sizeChart.some((r) => r[key] != null && r[key] !== ''));
  const fmt = (v) => (v == null || v === '' ? '—' : unit === 'in' ? cmToIn(v) : v);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="label-caps mb-0">Size chart</span>
        <div className="flex border border-ink/20 text-[11px] tracking-[0.14em] uppercase">
          {['in', 'cm'].map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`px-3 py-1 transition-colors ${
                unit === u ? 'bg-ink text-ivory' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto border border-ink/15">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-parchment text-left">
              <th className="px-3 py-2 font-medium text-[12px] tracking-[0.12em] uppercase">Size</th>
              {shownDims.map(([, label]) => (
                <th key={label} className="px-3 py-2 font-medium text-[12px] tracking-[0.12em] uppercase">
                  {label} ({unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizeChart.map((row) => (
              <tr
                key={row.size}
                className={`border-t border-ink/10 ${
                  highlightSize === row.size ? 'bg-clay/10 font-medium' : ''
                }`}
              >
                <td className="px-3 py-2">
                  {row.size}
                  {highlightSize === row.size && (
                    <span className="ml-2 text-clay text-[11px] uppercase tracking-wide">your fit</span>
                  )}
                </td>
                {shownDims.map(([key]) => (
                  <td key={key} className="px-3 py-2 text-ink-soft">{fmt(row[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
