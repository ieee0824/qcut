import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useFileOperationsStore } from '@/store/fileOperationsStore';
import { useVideoPreviewStore } from '@/store/videoPreviewStore';
import { useTimelineStore } from '@/store/timelineStore';
import { useProjectStore } from '@/store/projectStore';
import {
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  isAudioFile,
  getNextTrackId,
  extractFileName,
  getMediaDuration,
} from './fileOperationsUtils';

// --- メニューアイテムコンポーネント ---

interface MenuItemProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  fontSize?: string;
  color?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({
  onClick, disabled = false, children,
  fontSize = '14px', color = '#fff',
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'block',
      width: '100%',
      padding: '10px 16px',
      textAlign: 'left',
      backgroundColor: 'transparent',
      color,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize,
      opacity: disabled ? 0.6 : 1,
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3a3a3a')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
  >
    {children}
  </button>
);

const MenuDivider: React.FC = () => (
  <div style={{ height: '1px', backgroundColor: '#3a3a3a', margin: '4px 0' }} />
);

const MenuSectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ padding: '8px 16px', fontSize: '12px', color: '#999', fontWeight: 'bold' }}>
    {children}
  </div>
);

// --- メインコンポーネント ---

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
  const {
    saveProject, saveProjectAs, saveStatus, openProject, loadStatus,
    recentProjects, loadProjectFromPath, clearRecentProjects, removeRecentProject, isDirty,
  } = useProjectStore();

  const [showMenu, setShowMenu] = useState(false);

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
      const selected = await open({
        multiple: false,
        filters: [
          { name: t('fileOperations.videoFile'), extensions: VIDEO_EXTENSIONS },
          { name: t('fileOperations.audioFile'), extensions: AUDIO_EXTENSIONS },
          { name: t('fileOperations.allFiles'), extensions: ['*'] },
        ],
      });

      if (!selected) return;

      const fullPath = selected as string;
      const fileName = extractFileName(fullPath);
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
      const mediaType = isAudio ? 'audio' : 'video';

      if (!isAudio) {
        registerVideoUrl(fullPath, assetUrl);
      }

      const duration = await getMediaDuration(assetUrl, mediaType);
      const target = getTargetTrack(mediaType);

      addClip(target.trackId, {
        id: `clip-${Date.now()}`,
        name: fileName,
        startTime: target.startTime,
        duration,
        filePath: fullPath,
        sourceStartTime: 0,
        sourceEndTime: duration,
        color: isAudio ? '#4caf50' : '#4a9eff',
      });

      console.log('ファイルを選択しました:', fileInfo);
    } catch (error) {
      console.error('ファイル選択エラー:', error);
    } finally {
      setIsLoading(false);
    }
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

  const handleOpenRecentProject = async (path: string) => {
    if (isDirty) {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const proceed = await ask(
        '未保存の変更があります。保存せずに別のプロジェクトを開きますか？',
        { title: 'qcut', kind: 'warning' },
      );
      if (!proceed) return;
    }
    setShowMenu(false);
    await loadProjectFromPath(path);
  };

  return (
    <div style={{ position: 'relative' }}>
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
          <MenuItem
            onClick={() => { saveProject(); setShowMenu(false); }}
            disabled={saveStatus === 'saving'}
          >
            💾 {t('menu.save')}
          </MenuItem>

          <MenuItem
            onClick={() => { saveProjectAs(); setShowMenu(false); }}
            disabled={saveStatus === 'saving'}
          >
            📄 {t('menu.saveAs')}
          </MenuItem>

          <MenuDivider />

          <MenuItem
            onClick={() => { openProject(); setShowMenu(false); }}
            disabled={loadStatus === 'loading'}
          >
            📁 {t('menu.openProject')}
          </MenuItem>

          <MenuItem onClick={handleOpenFile} disabled={isLoading}>
            📂 {t('menu.open')}
          </MenuItem>

          {/* 最近のプロジェクト */}
          {recentProjects.length > 0 && (
            <>
              <MenuDivider />
              <div>
                <MenuSectionHeader>{t('menu.recentProjects')}</MenuSectionHeader>
                {recentProjects.map((project) => (
                  <button
                    key={project.path}
                    onClick={() => {
                      if (project.exists) {
                        handleOpenRecentProject(project.path);
                      }
                    }}
                    disabled={!project.exists}
                    title={project.path}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '8px 16px',
                      textAlign: 'left',
                      backgroundColor: 'transparent',
                      color: project.exists ? '#bbb' : '#666',
                      border: 'none',
                      cursor: project.exists ? 'pointer' : 'not-allowed',
                      fontSize: '13px',
                      opacity: project.exists ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => {
                      if (project.exists) e.currentTarget.style.backgroundColor = '#3a3a3a';
                    }}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentProject(project.path);
                      }}
                      style={{
                        marginLeft: '8px',
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: '11px',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
                    >
                      ✕
                    </span>
                  </button>
                ))}
                <MenuDivider />
                <MenuItem
                  onClick={() => { clearRecentProjects(); setShowMenu(false); }}
                  fontSize="12px"
                  color="#999"
                >
                  🗑️ {t('menu.clearProjects')}
                </MenuItem>
              </div>
            </>
          )}

          {/* 最近のファイル */}
          {recentFiles.length > 0 && (
            <>
              <MenuDivider />
              <div>
                <MenuSectionHeader>{t('menu.recent')}</MenuSectionHeader>
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
                <MenuDivider />
                <MenuItem
                  onClick={() => { clearRecentFiles(); setShowMenu(false); }}
                  fontSize="12px"
                  color="#999"
                >
                  🗑️ {t('menu.clear')}
                </MenuItem>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
