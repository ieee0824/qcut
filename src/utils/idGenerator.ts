/**
 * ユニークID生成ユーティリティ
 *
 * Date.now() と Math.random() を使用してユニークなIDを生成する。
 * テスト時は Date.now / Math.random をモックすることで決定的にテスト可能。
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
