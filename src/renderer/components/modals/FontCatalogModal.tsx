import React, { useEffect, useState, useRef, useCallback } from "react";

import AliasDialog from "./AliasDialog";
import { RemoteFontItem } from "../../../main/services/SyncEngine";
import { UnifiedFontData } from "../../../shared/types";
import { Toast } from "../ui/Toast";
import "./FontCatalogModal.css";

interface FontCatalogModalProps {
  isVisible: boolean;
  onClose: () => void;
  onFontInstalled: () => void;
}

const FontCatalogModal: React.FC<FontCatalogModalProps> = ({
  isVisible,
  onClose,
  onFontInstalled,
}) => {
  const [catalog, setCatalog] = useState<RemoteFontItem[]>([]);
  const [installedFonts, setInstalledFonts] = useState<UnifiedFontData[]>([]); // internal state (v12)
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingItem, setPendingItem] = useState<RemoteFontItem | null>(null);
  const [isAliasOpen, setIsAliasOpen] = useState(false);
  
  // [v12.3] Toast UI 상태 추가
  const [toastMsg, setToastMsg] = useState("");
  const [toastVariant, setToastVariant] = useState<"default" | "success" | "warning" | "error" | "white">("default");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // [v12] 로컬 파일 추가용 별도 상태
  const [pendingLocalPath, setPendingLocalPath] = useState<string | null>(null);
  const [analyzedLocalName, setAnalyzedLocalName] = useState("");
  const [isLocalAliasOpen, setIsLocalAliasOpen] = useState(false);

  const showToast = useCallback((msg: string, variant: "default" | "success" | "warning" | "error" | "white" = "default") => {
    setToastMsg(msg);
    setToastVariant(variant);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const loadCatalog = useCallback(async (force: boolean = false) => {
    if (force) setIsSyncing(true);
    else setIsLoading(true);

    setErrorMsg(null);
    try {
      // 1. 설치된 폰트 목록 먼저 가져오기 (v12)
      const installed = await window.electronAPI.font.getUnifiedFonts();
      setInstalledFonts(installed);

      // 2. 카탈로그 동기화
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
  }, []);

  useEffect(() => {
    if (isVisible) {
      loadCatalog();
    }
  }, [isVisible, loadCatalog]);

  useEffect(() => {
    const removeListener = window.electronAPI.font.onDownloadProgress(
      (data: { id: string; progress: number }) => {
        if (downloadingId === data.id) {
          setDownloadProgress(data.progress);
        }
      },
    );
    return () => removeListener();
  }, [downloadingId]);

  const handleManualAdd = async () => {
    try {
      // 1. 파일 선택
      const filePath = await window.electronAPI.font.pickFontFile();
      if (!filePath) return;

      setIsProcessing(true); // 오버레이 표시
      // 2. 바이너리 메타데이터 선분석
      const metadata = await window.electronAPI.font.analyzeFile(filePath);

      // 3. 기존 라이브러리와 중복 대조
      const isDuplicate = installedFonts.some(
        (f) => f.originalName === metadata.originalName,
      );

      if (isDuplicate) {
        showToast(`동일한 폰트('${metadata.originalName}')가 이미 라이브러리에 등록되어 있습니다.`, "error");
        setIsProcessing(false);
        return;
      }

      // 4. 신규 파일이면 별칭 입력 다이얼로그 오픈
      setPendingLocalPath(filePath);
      setAnalyzedLocalName(metadata.originalName);
      setIsLocalAliasOpen(true);
      setIsProcessing(false);
    } catch (err: unknown) {
      let message = "유효하지 않은 폰트 파일입니다.";
      const errStr = String(err);
      if (errStr.includes("이미 라이브러리에 등록")) {
        message = "이미 등록된 동일한 폰트가 존재합니다.";
      }
      showToast(message, "error");
      setIsProcessing(false);
    }
  };

  const confirmLocalAdd = async (customAlias: string) => {
    if (!pendingLocalPath) return;
    setIsLocalAliasOpen(false);

    try {
      setIsProcessing(true);
      await window.electronAPI.font.addFont(pendingLocalPath, undefined, customAlias);
      onFontInstalled(); // 라이브러리 리프레시 유도
      await loadCatalog(true); // 카탈로그 상태 업데이트
      showToast("로컬 폰트가 성공적으로 등록되었습니다.", "success");
    } catch (err: unknown) {
      let message = "폰트 등록 중 오류가 발생했습니다.";
      if (String(err).includes("이미 라이브러리에 등록")) {
        message = "이미 라이브러리에 등록된 폰트입니다.";
      }
      showToast(message, "error");
    } finally {
      setIsProcessing(false);
      setPendingLocalPath(null);
      setAnalyzedLocalName("");
    }
  };

  const handleDownloadClick = (item: RemoteFontItem) => {
    const isInstalled = installedFonts.some((f) => f.remoteSourceId === item.id);
    if (isInstalled) return;

    setPendingItem(item);
    setIsAliasOpen(true);
  };

  const confirmDownload = async (customAlias: string) => {
    if (!pendingItem) return;
    setIsAliasOpen(false);
    setDownloadingId(pendingItem.id);
    setIsProcessing(true);

    try {
      await window.electronAPI.font.downloadRemote(pendingItem, customAlias);
      showToast("폰트 설치가 완료되었습니다.", "success");
    } catch (err: unknown) {
      let message = "폰트 설치 중 오류가 발생했습니다.";
      const errStr = String(err);
      
      if (errStr.includes("이미 라이브러리에 등록")) {
        message = "이미 라이브러리에 등록되어 있는 폰트입니다.";
      } else if (errStr.includes("timeout")) {
        message = "연결 시간이 초과되었습니다. 다시 시도해 주세요.";
      }
      
      showToast(message, "error");
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
      setIsProcessing(false);
      setPendingItem(null);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`font-catalog-overlay ${isVisible ? "visible" : ""}`}
      onClick={onClose}
    >
      <div className="font-catalog-modal" onClick={(e) => e.stopPropagation()} ref={modalRef}>
        <Toast
          message={toastMsg}
          visible={toastVisible}
          container={modalRef.current}
          variant={toastVariant}
        />
        <header className="catalog-header">
          <div className="catalog-header-info">
            <h2>새 폰트 추가</h2>
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
              {catalog.map((item) => {
                // [v12.1] 계획 준수: 오직 remoteSourceId만으로 설치 여부 판별
                const isInstalled = installedFonts.some(
                  (f) => f.remoteSourceId === item.id,
                );
                return (
                  <FontCard
                    key={item.id}
                    item={item}
                    isInstalled={isInstalled}
                    isDownloading={downloadingId === item.id}
                    progress={downloadProgress}
                    onDownload={() => handleDownloadClick(item)}
                  />
                );
              })}
            </div>
          )}
        </main>

        <footer className="catalog-footer">
          <div className="footer-left">
            <button className="manual-add-btn" onClick={handleManualAdd}>
              <span className="material-symbols-outlined">upload_file</span>
              <span>수동 파일 추가</span>
            </button>
          </div>
          <button className="catalog-close-main" onClick={onClose}>
            닫기
          </button>
        </footer>

        {/* 설치 처리 중 오버레이 */}
        {isProcessing && (
          <div className="font-loading-overlay">
            <div className="font-loading-content">
              <div className="font-spinner"></div>
              <p>폰트를 라이브러리에 추가하는 중...</p>
              <small>서버에서 파일을 받아 정보를 분석하고 있습니다.</small>
            </div>
          </div>
        )}
        {/* Alias Input Dialog [v11/v12] */}
        {isAliasOpen && pendingItem && (
          <AliasDialog
            key={pendingItem.id}
            isVisible={true}
            title="폰트 추가 - 별칭 지정"
            defaultAlias={pendingItem.alias}
            onConfirm={confirmDownload}
            onCancel={() => {
              setIsAliasOpen(false);
              setPendingItem(null);
            }}
          />
        )}

        {/* Local File Alias Dialog [v12] */}
        {isLocalAliasOpen && analyzedLocalName && (
          <AliasDialog
            key={pendingLocalPath}
            isVisible={true}
            title="수동 폰트 추가 - 별칭 지정"
            defaultAlias={analyzedLocalName}
            onConfirm={confirmLocalAdd}
            onCancel={() => {
              setIsLocalAliasOpen(false);
              setPendingLocalPath(null);
              setAnalyzedLocalName("");
            }}
          />
        )}
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
  const [imgLoaded, setImgLoaded] = useState(false);
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
      <div className={`font-card-preview ${imgLoaded ? "has-image" : ""}`}>
        {isVisible ? (
          <img
            src={previewUrl}
            alt={item.alias}
            className={imgLoaded ? "loaded" : ""}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="placeholder">썸네일 로딩 중...</div>
        )}
      </div>
      <div className="font-card-info">
        <div>
          <div className="font-card-name">
            {item.alias} <span className="font-card-id-sub">- {item.id}</span>
          </div>
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
        title={
          isInstalled
            ? "이미 라이브러리에 추가되었습니다."
            : isDownloading
              ? "다운로드가 진행 중입니다."
              : "이 폰트를 라이브러리에 다운로드하고 추가합니다."
        }
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
              : "추가"}
        </span>
      </button>
    </div>
  );
};

export default FontCatalogModal;
