import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useFileOperationsStore } from '@/store/fileOperationsStore';
import { useVideoPreviewStore } from '@/store/videoPreviewStore';
import { useTimelineStore } from '@/store/timelineStore';
import { useProjectStore } from '@/store/projectStore';

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
  const { saveProject, saveProjectAs, saveStatus } = useProjectStore();

  const [showMenu, setShowMenu] = useState(false);

  const AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac', 'wma'];

  const isAudioFile = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    return AUDIO_EXTENSIONS.includes(ext);
  };

  const getNextTrackId = (existingTracks: typeof tracks, type: 'video' | 'audio') => {
    const prefix = type === 'video' ? 'video' : 'audio';
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    const indices = existingTracks
      .filter((track) => track.type === type)
      .map((track) => {
        const match = track.id.match(pattern);
        return match ? Number(match[1]) : 0;
      })
      .filter((value) => Number.isFinite(value));

    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;
    return `${prefix}-${nextIndex}`;
  };

  const getTargetTrack = (type: 'video' | 'audio') => {
    const typeTracks = tracks.filter((track) => track.type === type);
    const emptyTrack = typeTracks.find((track) => track.clips.length === 0);

    if (emptyTrack) {
      return { trackId: emptyTrack.id, startTime: 0 };
    }

    const newTrackId = getNextTrackId(tracks, type);
    const label = type === 'video' ? 'Video' : 'Audio';
    addTrack({
      id: newTrackId,
      type,
      name: `${label} ${newTrackId.replace(`${type}-`, '')}`,
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
            name: t('fileOperations.audioFile'),
            extensions: AUDIO_EXTENSIONS,
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

      const isAudio = isAudioFile(fullPath);

      if (isAudio) {
        // 音声ファイルの場合
        const audioDuration = await getAudioDurationFromUrl(assetUrl);
        const clipId = `clip-${Date.now()}`;
        const target = getTargetTrack('audio');

        addClip(target.trackId, {
          id: clipId,
          name: fileName,
          startTime: target.startTime,
          duration: audioDuration,
          filePath: fullPath,
          sourceStartTime: 0,
          sourceEndTime: audioDuration,
          color: '#4caf50',
        });
      } else {
        // 動画ファイルの場合
        registerVideoUrl(fullPath, assetUrl);
        const videoDuration = await getVideoDurationFromUrl(assetUrl);
        const clipId = `clip-${Date.now()}`;
        const target = getTargetTrack('video');

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
      }

      console.log('ファイルを選択しました:', fileInfo);
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

  // 音声の長さを取得するヘルパー関数
  const getAudioDurationFromUrl = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };

      audio.onerror = () => {
        reject(new Error('音声のメタデータ読み込みに失敗しました'));
      };

      audio.src = url;
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
          {/* 保存 */}
          <button
            onClick={() => { saveProject(); setShowMenu(false); }}
            disabled={saveStatus === 'saving'}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              backgroundColor: 'transparent',
              color: '#fff',
              border: 'none',
              cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: saveStatus === 'saving' ? 0.6 : 1,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = '#3a3a3a')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            💾 {t('menu.save')}
          </button>

          {/* 名前を付けて保存 */}
          <button
            onClick={() => { saveProjectAs(); setShowMenu(false); }}
            disabled={saveStatus === 'saving'}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              backgroundColor: 'transparent',
              color: '#fff',
              border: 'none',
              cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: saveStatus === 'saving' ? 0.6 : 1,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = '#3a3a3a')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            📄 {t('menu.saveAs')}
          </button>

          {/* 区切り線 */}
          <div
            style={{
              height: '1px',
              backgroundColor: '#3a3a3a',
              margin: '4px 0',
            }}
          />

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
