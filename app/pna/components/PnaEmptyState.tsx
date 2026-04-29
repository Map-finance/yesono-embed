interface PnaEmptyStateProps {
  message: string;
  className?: string;
}

export default function PnaEmptyState({ message, className = "" }: PnaEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 ${className}`.trim()}>
      <span className="text-4xl">📋</span>
      <span className="text-[14px] text-(--text-primary)">{message}</span>
    </div>
  );
}
