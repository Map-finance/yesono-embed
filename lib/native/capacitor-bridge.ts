/**
 * yesono-embed stub：iframe 场景没有 Capacitor 原生能力。
 *
 * 原 h2-market 里 hapticImpact / hapticNotification 会调 @capacitor/haptics 触发
 * iOS/Android 马达振动。embed 是纯 Web iframe，保留同名同签以保证调用方无需改动。
 */

export type HapticImpactStyle = "Light" | "Medium" | "Heavy";

export async function hapticImpact(_style: HapticImpactStyle = "Medium"): Promise<void> {
  // no-op in embed
}

export async function hapticNotification(
  _type: "Success" | "Warning" | "Error" = "Success"
): Promise<void> {
  // no-op in embed
}

export async function hapticSelection(): Promise<void> {
  // no-op in embed
}
