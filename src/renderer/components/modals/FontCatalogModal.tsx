import React, { useEffect, useState, useRef } from "react";

import { RemoteFontItem } from "../../../main/services/SyncEngine";
import { UnifiedFontData } from "../../../shared/types";
import "./FontCatalogModal.css";

interface FontCatalogModalProps {
  isVisible: boolean;
  onClose: () => void;
  installedFonts: UnifiedFontData[];
  onManualAdd: () => void;
  onFontInstalled: () => void;
}

const FontCatalogModal: React.FC<FontCatalogModalProps> = ({
  isVisible,
  onClose,
  installedFonts,
  onManualAdd,
  onFontInstalled,
}) => {
  const [catalog, setCatalog] = useState<RemoteFontItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isVisible) {
      loadCatalog();
    }
  }, [isVisible]);

  const loadCatalog = async (force: boolean = false) => {
    if (force) setIsSyncing(true);
    else setIsLoading(true);

    setErrorMsg(null);
    try {
      // getCatalog 대신 syncCatalog를 호출 (동기화 엔진의 24시간 정책 활용)
      const data = await window.electronAPI.font.syncCatalog(force);
      setCatalog(data);
      if (data.length === 0) {
        setErrorMsg(
          "폰트 목록을 가져올 수 없습니다. 서버 상태를 확인해 주세요.",
        );
      }
    } catch (_err) {
      setErrorMsg("원격 카탈로그 동기화 실패. 오프라인 상태일 수 있습니다.");
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  };

  const handleDownload = async (item: RemoteFontItem) => {
    if (downloadingId) return;

    setDownloadingId(item.id);
    setDownloadProgress(0);

    try {
      // 메인 프로세스의 applyBatch 로직을 재사용하거나, 직접 다운로드 요청
      // 여기서는 명시적인 '다운로드' 행위를 수행 (FontManager.applyBatch 내부의 자동 다운로드 로직과 일관성 유지)
      // 실제 구현에서는 applyBatch가 자동으로 해주지만, UI 피드백을 위해 수동 트리거 가능하게 설계
      const assignments = { "Kakao Games": item.id }; // 임시 할당을 통한 다운로드 유도
      await window.electronAPI.font.applyBatch(assignments);
      onFontInstalled(); // 설치 완료 알림
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`다운로드 실패: ${message}`);
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`font-catalog-overlay ${isVisible ? "visible" : ""}`}
      onClick={onClose}
    >
      <div className="font-catalog-modal" onClick={(e) => e.stopPropagation()}>
        <header className="catalog-header">
          <div className="catalog-header-info">
            <h2>PoE2 온라인 폰트 저장소</h2>
            <p>서버에서 최신 폰트를 탐색하고 라이브러리에 추가하세요.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              className={`catalog-refresh-btn ${isSyncing ? "spinning" : ""}`}
              onClick={() => !isSyncing && loadCatalog(true)}
              title="동기화 갱신"
            >
              <span className="material-symbols-outlined">refresh</span>
            </button>
            <button className="catalog-close-btn" onClick={onClose}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        <main className="catalog-content">
          {isLoading ? (
            <div className="catalog-status">목록을 불러오는 중...</div>
          ) : errorMsg ? (
            <div className="catalog-status error">{errorMsg}</div>
          ) : (
            <div className="catalog-grid">
              {catalog.map((item) => (
                <FontCard
                  key={item.id}
                  item={item}
                  isInstalled={installedFonts.some((f) => f.id === item.id)}
                  isDownloading={downloadingId === item.id}
                  progress={downloadProgress}
                  onDownload={() => handleDownload(item)}
                />
              ))}
            </div>
          )}
        </main>

        <footer className="catalog-footer">
          <div className="footer-left">
            <button className="manual-add-btn" onClick={onManualAdd}>
              <span className="material-symbols-outlined">upload_file</span>
              <span>수동 파일 추가</span>
            </button>
          </div>
          <button className="catalog-close-main" onClick={onClose}>
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
};

interface FontCardProps {
  item: RemoteFontItem;
  isInstalled: boolean;
  isDownloading: boolean;
  progress: number;
  onDownload: () => void;
}

const FontCard: React.FC<FontCardProps> = ({
  item,
  isInstalled,
  isDownloading,
  progress,
  onDownload,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (cardRef.current) obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, []);

  const fileSizeMB = (item.fileSize / (1024 * 1024)).toFixed(1);
  const previewUrl = `https://nerdhead-lab.github.io/POE2-unofficial-launcher/fonts/${item.previewPath}`;

  return (
    <div className="font-card" ref={cardRef}>
      <div className="font-card-preview">
        {isVisible ? (
          <img
            src={previewUrl}
            alt={item.alias}
            className="loaded"
            onLoad={(e) => (e.currentTarget.style.opacity = "1")}
          />
        ) : (
          <div className="placeholder">썸네일 로딩 중...</div>
        )}
      </div>
      <div className="font-card-info">
        <div>
          <div className="font-card-name">{item.alias}</div>
          <div className="font-card-meta">
            <span>{fileSizeMB} MB</span>
            <span>•</span>
            <span title={item.license}>
              {item.license.length > 20
                ? item.license.substring(0, 20) + "..."
                : item.license}
            </span>
          </div>
        </div>
      </div>
      <button
        className={`font-card-btn ${isInstalled ? "installed" : "download-ready"}`}
        disabled={isInstalled || isDownloading}
        onClick={onDownload}
      >
        {isDownloading && (
          <div
            className="card-progress-bar"
            style={{ width: `${progress}%` }}
          ></div>
        )}
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "18px" }}
        >
          {isInstalled
            ? "check_circle"
            : isDownloading
              ? "downloading"
              : "download"}
        </span>
        <span>
          {isInstalled
            ? "이미 설치됨"
            : isDownloading
              ? "다운로드 중..."
              : "동기화 및 추가"}
        </span>
      </button>
    </div>
  );
};

export default FontCatalogModal;
