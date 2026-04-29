import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // 项目用 data-theme 而非 .dark class，shadcn 默认 bg-muted 在暗主题下退化成
      // 浅色（oklch(0.97 0 0) ≈ 近白）→ 闪一片白线，刺眼。
      // 改用 text-primary 低透明度叠加：暗主题 ≈ 3% 白覆盖（可见但柔和），亮主题
      // ≈ 3% 黑覆盖。3% 是经验值，再低就看不见了。
      className={cn("animate-pulse rounded-md bg-[var(--text-primary)]/[0.03]", className)}
      {...props}
    />
  )
}

export { Skeleton }
