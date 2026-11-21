// value: 0..1, or -1 for unknown size
export default function ProgressBar({ value, label }: { value: number; label?: string }) {
  const unknown = value < 0;
  return (
    <div className="w-full">
      {label && <div className="mb-1 text-xs text-neutral-300">{label}</div>}
      <div className="h-2 w-full overflow-hidden rounded bg-neutral-700">
        <div
          className={'h-full bg-rast-gold transition-all ' + (unknown ? 'w-full animate-pulse' : '')}
          style={unknown ? undefined : { width: Math.round(Math.min(1, value) * 100) + '%' }}
        />
      </div>
    </div>
  );
}
