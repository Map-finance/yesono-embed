/**
 * 服务器时间校准
 *
 * 用行情 WS 推送里的服务器时间戳(如 crypto_prices 的 payload.timestamp)校准本地时钟,
 * 让倒计时 / 结算判定不受用户本地时间不准影响。
 *
 * - 有校准:serverNow() = Date.now() + offset(offset = 服务器时间 − 本地时间)
 * - 无任何校准(没收到 WS):offset = 0,serverNow() 退化为本地 Date.now()
 *
 * 注:WS timestamp 是「服务器生成该 tick 的时刻」,到达客户端有单程网络延迟,
 *     故 serverNow() 比真实服务器时间慢约一个延迟(几十~几百 ms),对秒级倒计时无影响。
 */

let offsetMs = 0; // serverNow - Date.now()
let synced = false;

/**
 * 用一条带服务器时间戳(ms)的消息校准。
 *
 * offset「只升不降」(取历次最大样本),原因:
 *  - serverMs 是 tick「生成时刻」,到达客户端还要加网络延迟,且时间戳按秒取整,
 *    故每个样本 sample = serverMs − now ≤ 真实 offset;样本越大 = 延迟越小 = 越接近真实。
 *  - 取 max → 用延迟最小的那条 tick 收敛到真实 offset,且永不超过它
 *    ⇒ serverNow() ≤ 真实服务器时间 ⇒ 倒计时只会偏慢几十 ms,绝不提前归零。
 *  - offset 单调不减 ⇒ serverNow() 单调不减 ⇒ 倒计时单调不增(不会往回跳)。
 *  首条样本设基线(可正可负,纠正快/慢两种本地时钟),之后只取更大的。
 */
export function syncServerTime(serverMs: number): void {
  if (!Number.isFinite(serverMs) || serverMs <= 0) return;
  const sample = serverMs - Date.now();
  if (!synced) {
    offsetMs = sample;
    synced = true;
  } else if (sample > offsetMs) {
    offsetMs = sample;
  }
}

/** 服务器校准后的当前时间(ms);未校准时 = 本地 Date.now() */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** 当前偏移量(ms,服务器 − 本地);调试用 */
export function getServerTimeOffset(): number {
  return offsetMs;
}
