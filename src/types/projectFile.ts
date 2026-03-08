import type {
  ClipEffects,
  TextProperties,
  ClipTransition,
} from '../store/timelineStore';
import type { ExportSettings } from '../store/exportStore';

/**
 * .qcut プロジェクトファイルの現在のスキーマバージョン
 *
 * バージョニング方針:
 * - フィールド追加（後方互換）: マイナーバージョンを上げる (1 → 2)
 * - 破壊的変更（既存フィールドの型変更・削除）: メジャーバージョンを上げる (1 → 100)
 * - 読み込み時はマイグレーション関数で古いバージョンを最新に変換する
 */
export const CURRENT_SCHEMA_VERSION = 1;

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
}

// --- タイムライン ---

export interface ProjectTimeline {
  tracks: ProjectTrack[];
}

export interface ProjectTrack {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  clips: ProjectClip[];
  volume: number;
  mute: boolean;
  solo: boolean;
}

export interface ProjectClip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  color?: string;

  /** 素材ファイルパス（プロジェクトファイルからの相対パス） */
  filePath: string;
  sourceStartTime: number;
  sourceEndTime: number;

  effects?: ClipEffects;
  textProperties?: TextProperties;
  transition?: ClipTransition;
}
