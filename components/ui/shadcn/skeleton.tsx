import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // 用 text-primary 的低透明度叠加：暗主题 = 5% 白覆盖 bg（可见但不刺眼），
      // 亮主题 = 5% 黑覆盖（同样可见）。
      // 不用 shadcn 的 bg-muted，因为项目用 data-theme 而非 .dark class，
      // shadcn 的 dark variant 不触发会退到 light 主题的 oklch(0.97 0 0) ≈ 近白，
      // 在暗背景上闪一片白色，刺眼。
      className={cn("animate-pulse rounded-md bg-[var(--text-primary)]/[0.06]", className)}
      {...props}
    />
  )
}

export { Skeleton }
