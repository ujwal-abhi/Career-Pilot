import { useState, type ReactNode } from "react";

interface ChartCardProps {
  title: string;
  question: string;
  // The same data as the chart, as a table. Charts alone are hard to read with a screen
  // reader or when you want the exact number, so every chart can flip to a table.
  tableColumns: string[];
  tableRows: (string | number)[][];
  footnote?: string;
  children: ReactNode;
}

export function ChartCard({ title, question, tableColumns, tableRows, footnote, children }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="rounded-lg bg-slate-800 border border-slate-700 p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-slate-400">{question}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          aria-pressed={showTable}
          className="shrink-0 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:text-white"
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                {tableColumns.map((column) => (
                  <th key={column} className="py-1 pr-4 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-slate-700/50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="py-1 pr-4 text-slate-200">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}

      {footnote && <p className="text-xs text-slate-500 mt-3">{footnote}</p>}
    </section>
  );
}