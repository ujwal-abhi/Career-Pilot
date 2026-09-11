interface StatCardProps {
  label: string;
  value: number;
  accentClassName?: string;
}

export function StatCard({ label, value, accentClassName = "text-white" }: StatCardProps) {
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-3xl font-bold ${accentClassName}`}>{value}</p>
    </div>
  );
}