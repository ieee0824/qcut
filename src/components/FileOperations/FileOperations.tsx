import React, { useState, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  // showRecentMenu は将来的なサブメニュー実装時に使用

  const handleOpenFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIsLoading(true);
    try {
      const file = event.target.files?.[0];
      if (file) {
        const fileInfo = {
          name: file.name,
          path: file.name, // ブラウザのセキュリティ制約でフルパスは取得不可
          size: file.size,
          lastModified: file.lastModified,
        };

        setCurrentFile(fileInfo);
        addRecentFile(fileInfo);
        setShowMenu(false); // ファイル選択後にメニューを閉じる
        console.log('ファイルを選択しました:', fileInfo);
      }
    } catch (error) {
      console.error('ファイル選択エラー:', error);
    } finally {
      setIsLoading(false);
      // input をリセット（同じファイルを再度選択可能にするため）
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      
      {/* 隠れたファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,video/x-flv,video/x-ms-wmv,video/3gpp"
        onChange={handleFileSelected}
        style={{ display: 'none' }}
      />
    </div>
  );
};
