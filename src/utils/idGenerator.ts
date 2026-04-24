/**
 * ユニークID生成に必要な外部入力。
 * 呼び出し元がこの値を固定すれば、ID 生成は参照透過になる。
 */
export interface IdEntropy {
  timestamp: number;
  randomValue: number;
}

/**
 * 純粋な ID フォーマッタ。
 */
export function buildId(prefix: string, entropy: IdEntropy): string {
  return `${prefix}-${entropy.timestamp}-${entropy.randomValue.toString(36).slice(2, 8)}`;
}

/**
 * 既定では現在時刻と乱数を使う薄いラッパー。
 */
export function generateId(
  prefix: string,
  entropy: IdEntropy = { timestamp: Date.now(), randomValue: Math.random() },
): string {
  return buildId(prefix, entropy);
}
