import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useFileOperationsStore } from '@/store/fileOperationsStore';

export const FileOperations: React.FC = () => {
  const {
    currentFile,
    isLoading,
    recentFiles,
    setCurrentFile,
    addRecentFile,
    setIsLoading,
    clearRecentFiles,
  } = useFileOperationsStore();

  const [showMenu, setShowMenu] = useState(false);
  // showRecentMenu は将来的なサブメニュー実装時に使用

  const handleOpenFile = async () => {
    setIsLoading(true);
    try {
      const selected = await open({
        filters: [{ name: 'ビデオファイル', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp'] }, { name: 'すべてのファイル', extensions: ['*'] }],
        title: 'ビデオファイルを開く',
      });

      if (selected && typeof selected === 'string') {
        // ファイル情報を取得
        try {
          const fileInfo = {
            name: selected.split('/').pop() || 'unknown',
            path: selected,
            size: 0, // TODO: Tauri コマンドで取得
            lastModified: Date.now(),
          };

          // store に追加
          setCurrentFile(fileInfo);
          addRecentFile(fileInfo);
        } catch (error) {
          console.error('ファイル情報の取得に失敗:', error);
        }
      }
    } catch (error) {
      console.error('ファイルダイアログのエラー:', error);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('ja-JP');
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
        📁 ファイル
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
            onClick={() => {
              handleOpenFile();
              setShowMenu(false);
            }}
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
            📂 ファイルを開く
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
                最近のファイル
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
                🗑️ 履歴をクリア
              </button>
            </div>
          )}
        </div>
      )}

      {/* 現在のファイル情報 */}
      {currentFile && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#2a2a2a',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#ccc',
          }}
        >
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#999' }}>現在のファイル:</span>
            <div
              style={{
                marginTop: '4px',
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentFile.name}
            </div>
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ color: '#999' }}>サイズ:</span>{' '}
            {formatFileSize(currentFile.size)}
          </div>
          <div>
            <span style={{ color: '#999' }}>変更日時:</span>{' '}
            {formatDate(currentFile.lastModified)}
          </div>
        </div>
      )}
    </div>
  );
};
