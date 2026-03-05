import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useFileOperationsStore } from '@/store/fileOperationsStore';
import { useVideoPreviewStore } from '@/store/videoPreviewStore';
import { useTimelineStore } from '@/store/timelineStore';

export const FileOperations: React.FC = () => {
  const { t } = useTranslation();
  const {
    isLoading,
    recentFiles,
    setCurrentFile,
    addRecentFile,
    setIsLoading,
    clearRecentFiles,
  } = useFileOperationsStore();

  const { registerVideoUrl } = useVideoPreviewStore();
  const { addClip, addTrack, tracks } = useTimelineStore();

  const [showMenu, setShowMenu] = useState(false);

  const getNextVideoTrackId = (existingTracks: typeof tracks) => {
    const indices = existingTracks
      .filter((track) => track.type === 'video')
      .map((track) => {
        const match = track.id.match(/^video-(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .filter((value) => Number.isFinite(value));

    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;
    return `video-${nextIndex}`;
  };

  const getTargetVideoTrack = () => {
    const videoTracks = tracks.filter((track) => track.type === 'video');
    const emptyTrack = videoTracks.find((track) => track.clips.length === 0);

    if (emptyTrack) {
      return { trackId: emptyTrack.id, startTime: 0 };
    }

    const newTrackId = getNextVideoTrackId(tracks);
    addTrack({
      id: newTrackId,
      type: 'video',
      name: `Video ${newTrackId.replace('video-', '')}`,
      clips: [],
    });

    return { trackId: newTrackId, startTime: 0 };
  };

  const handleOpenFile = async () => {
    setShowMenu(false);
    setIsLoading(true);
    try {
      // Tauriダイアログでフルパスを取得
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: t('fileOperations.videoFile'),
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp'],
          },
          {
            name: t('fileOperations.allFiles'),
            extensions: ['*'],
          },
        ],
      });

      if (!selected) return;

      const fullPath = selected as string;
      const fileName = fullPath.split('/').pop() ?? fullPath.split('\\').pop() ?? fullPath;

      // convertFileSrc でWebViewから直接アクセス可能なURLを取得
      const assetUrl = convertFileSrc(fullPath);

      const fileInfo = {
        name: fileName,
        path: fullPath,
        size: 0,
        lastModified: Date.now(),
      };

      setCurrentFile(fileInfo);
      addRecentFile(fileInfo);
      registerVideoUrl(fullPath, assetUrl);

      // 動画の長さを取得してタイムラインにクリップを追加
      const videoDuration = await getVideoDurationFromUrl(assetUrl);
      const clipId = `clip-${Date.now()}`;

      const target = getTargetVideoTrack();
      if (!target) {
        throw new Error('ビデオトラックが見つかりません');
      }

      addClip(target.trackId, {
        id: clipId,
        name: fileName,
        startTime: target.startTime,
        duration: videoDuration,
        filePath: fullPath,
        sourceStartTime: 0,
        sourceEndTime: videoDuration,
        color: '#4a9eff',
      });

      console.log('ファイルを選択しました:', fileInfo);
      console.log('クリップを追加しました:', clipId, 'duration:', videoDuration);
    } catch (error) {
      console.error('ファイル選択エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 動画の長さを取得するヘルパー関数
  const getVideoDurationFromUrl = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        resolve(video.duration);
      };

      video.onerror = () => {
        reject(new Error('動画のメタデータ読み込みに失敗しました'));
      };

      video.src = url;
    });
  };

  const handleOpenRecentFile = async (path: string) => {
    setIsLoading(true);
    try {
      // TODO: 最近のファイルを開く
      console.log(`Opening recent file: ${path}`);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div style={{ position: 'relative' }}>
      {/* メニューボタン */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isLoading}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#4a9eff',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {t('menu.file')}
      </button>

      {/* ドロップダウンメニュー */}
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '8px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: '4px',
            minWidth: '200px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* ファイルを開く */}
          <button
            onClick={handleOpenFile}
            disabled={isLoading}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              backgroundColor: 'transparent',
              color: '#fff',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isLoading ? 0.6 : 1,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = '#3a3a3a')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            📂 {t('menu.open')}
          </button>

          {/* 区切り線 */}
          {recentFiles.length > 0 && (
            <div
              style={{
                height: '1px',
                backgroundColor: '#3a3a3a',
                margin: '4px 0',
              }}
            />
          )}

          {/* 最近のファイル */}
          {recentFiles.length > 0 && (
            <div>
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: '12px',
                  color: '#999',
                  fontWeight: 'bold',
                }}
              >
                {t('menu.recent')}
              </div>
              {recentFiles.map((file) => (
                <button
                  key={file.path}
                  onClick={() => {
                    handleOpenRecentFile(file.path);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 16px',
                    textAlign: 'left',
                    backgroundColor: 'transparent',
                    color: '#bbb',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = '#3a3a3a')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  {file.name}
                </button>
              ))}

              <div
                style={{
                  height: '1px',
                  backgroundColor: '#3a3a3a',
                  margin: '4px 0',
                }}
              />

              {/* 履歴をクリア */}
              <button
                onClick={() => {
                  clearRecentFiles();
                  setShowMenu(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 16px',
                  textAlign: 'left',
                  backgroundColor: 'transparent',
                  color: '#999',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#3a3a3a')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
              >
                🗑️ {t('menu.clear')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
