import { redirect } from "next/navigation";

/**
 * 中文注释：
 * - 这里使用服务端重定向，避免客户端 useRouter 在预渲染阶段触发
 *   `useSearchParams should be wrapped in a suspense boundary` 相关报错。
 * - /sports/live 的职责只是跳转到 /sports?tag=live，不需要客户端渲染。
 */
export default function SportsLivePage() {
  redirect("/sports?tag=live");
}
