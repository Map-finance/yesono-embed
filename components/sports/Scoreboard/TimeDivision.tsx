export default function TimeDivision({ time }: { time: Date }) {
    const weekday = time.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const monthDay = time.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    return (
        <div className="bg-[var(--bg-secondary)] px-1 text-sm flex flex-col justify-center items-center border-[var(--border)] whitespace-nowrap cursor-pointer hover:bg-[var(--bg-hover)]">
            <div className="font-semibold">{weekday}</div>
            <div className="text-[var(--text-secondary)]">{monthDay}</div>
        </div>
    )
}