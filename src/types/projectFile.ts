import type { Clip, Track } from '../store/timelineStore';
import type { ExportSettings } from '../store/exportStore';

/**
 * .qcut プロジェクトファイルの現在のスキーマバージョン
 *
 * バージョニング方針:
 * - フィールド追加（後方互換）: マイナーバージョンを上げる (1 → 2)
 * - 破壊的変更（既存フィールドの型変更・削除）: メジャーバージョンを上げる (1 → 100)
 * - 読み込み時はマイグレーション関数で古いバージョンを最新に変換する
 */
export const CURRENT_SCHEMA_VERSION = 2;

// --- プロジェクトファイルのルート ---

export interface ProjectFile {
  schemaVersion: number;
  appVersion: string;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  metadata: ProjectMetadata;
  timeline: ProjectTimeline;
  exportSettings: ExportSettings;
}

// --- メタデータ ---

export interface ProjectMetadata {
  name: string;
  /** プロジェクトファイルの保存先ディレクトリからの相対パスで素材を参照するための基準パス */
  basePath?: string;
  /** 自動保存時に元のプロジェクトファイルパスを記録する（復旧時に使用） */
  originalPath?: string;
}

// --- タイムライン ---

export interface ProjectTimeline {
  tracks: ProjectTrack[];
}

/**
 * ProjectTrack / ProjectClip は runtime の Track / Clip と同一型を使用する。
 * 手動でフィールドを列挙すると新規フィールド追加時に漏れが発生するため、
 * 型エイリアスで統一する。
 */
export type ProjectClip = Clip;
export type ProjectTrack = Track;
