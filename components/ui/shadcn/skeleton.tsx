import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // 用项目 --bg-secondary 而非 shadcn 的 --muted（在 light 主题下接近白
      // 闪烁很显眼，又因项目用 data-theme 而非 .dark class，shadcn 的
      // dark variant 不触发，会退到 light 主题的 oklch(0.97 0 0) ≈ 近白）
      className={cn("animate-pulse rounded-md bg-[var(--bg-secondary)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
