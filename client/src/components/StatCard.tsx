interface StatCardProps {
  label: string;
  value: number | string;
  accentClassName?: string;
  hint?: string;
}

export function StatCard({ label, value, accentClassName = "text-white", hint }: StatCardProps) {
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-3xl font-bold ${accentClassName}`}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}