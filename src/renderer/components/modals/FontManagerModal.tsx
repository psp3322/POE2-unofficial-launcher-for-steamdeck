import React, { useEffect, useState, useRef } from "react";

import { AppConfig, CustomFontData } from "../../../shared/types";
import { useGameState } from "../../contexts/GameStateContext";
import "./FontManagerModal.css";

interface FontManagerModalProps {
  isVisible: boolean;
  onClose: () => void;
  gameId: AppConfig["activeGame"];
}

const FontManagerModal: React.FC<FontManagerModalProps> = ({
  isVisible,
  onClose,
  gameId,
}) => {
  const [fonts, setFonts] = useState<CustomFontData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [operationResult, setOperationResult] = useState<
    "success" | "error" | null
  >(null);
  const [errorDetail, setErrorDetail] = useState("");

  // Tracking applied fonts from config
  const [appliedFonts, setAppliedFonts] = useState<Record<string, string>>({});

  // Independent selection state for each service
  const [selectedFontKakao, setSelectedFontKakao] = useState<string>("");
  const [selectedFontGGG, setSelectedFontGGG] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getActiveGameState, syncGameState } = useGameState();

  // Game states for both services to prevent modifying fonts while corresponding game runs
  const kakaoGameStatus = getActiveGameState(gameId, "Kakao Games");
  const gggGameStatus = getActiveGameState(gameId, "GGG");

  const fetchFonts = async () => {
    try {
      const data = await window.electronAPI.font.getFonts();
      setFonts(data);
    } catch (e) {
      console.error("Failed to fetch fonts", e);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchFonts();
      syncGameState(gameId, "Kakao Games");
      syncGameState(gameId, "GGG");

      // Load applied fonts state from config
      window.electronAPI
        .getConfig("appliedFonts")
        .then((config) => {
          if (config && typeof config === "object") {
            const af = config as Record<string, string>;
            setAppliedFonts(af);
            // Default selection to applied fonts
            if (af["Kakao Games"]) setSelectedFontKakao(af["Kakao Games"]);
            if (af["GGG"]) setSelectedFontGGG(af["GGG"]);
          }
        })
        .catch(console.error);
    }
  }, [isVisible, gameId, syncGameState]);

  const handleClose = () => {
    onClose();
  };

  const handleFontFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      await window.electronAPI.font.addFont(
        (file as File & { path: string }).path,
      );
      await fetchFonts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`폰트 등록 실패: ${msg}`);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteFont = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("이 폰트를 라이브러리에서 삭제하시겠습니까?")) {
      setIsLoading(true);
      try {
        await window.electronAPI.font.removeFont(id);
        if (selectedFontKakao === id) setSelectedFontKakao("");
        if (selectedFontGGG === id) setSelectedFontGGG("");
        await fetchFonts();
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleApplyFont = async (
    serviceId: AppConfig["serviceChannel"],
    selectedFontId: string,
  ) => {
    if (!selectedFontId) {
      return alert("적용할 폰트를 선택해주세요.");
    }

    setIsLoading(true);
    setLoadingMessage(
      "단계 1: 폰트 무결성 분석 및 변조 중... (대용량 폰트의 경우 20~30초 소요될 수 있습니다)",
    );
    try {
      // Small delay to ensure the UI updates before the heavy worker starts
      await new Promise((r) => setTimeout(r, 100));

      // Actually, applyFont involves potentially multiple targets, we'll just keep the message simple
      // Ideally we'd have IPC progress events, but for now we set the installer message
      const mutationFinishPromise = window.electronAPI.font.applyFont(
        serviceId,
        selectedFontId,
      );

      // We don't have perfect progress tracking for the system install part yet,
      // but we know it happens after mutation.
      await mutationFinishPromise;

      // Update local state after success
      setAppliedFonts((prev) => ({ ...prev, [serviceId]: selectedFontId }));
      setOperationResult("success");

      // Auto clear result after 3 seconds
      setTimeout(() => setOperationResult(null), 3000);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message?.includes("UAC")) {
        console.warn("UAC Denied");
        setOperationResult(null); // Just close
      } else {
        setOperationResult("error");
        setErrorDetail(error.message || String(err));
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleRestoreFont = async (serviceId: AppConfig["serviceChannel"]) => {
    if (
      !confirm(`정말로 ${serviceId}의 폰트 설정을 기본값으로 복구하시겠습니까?`)
    )
      return;

    setIsLoading(true);
    setLoadingMessage("시스템 폰트 설정 복구 중...");
    try {
      await window.electronAPI.font.restoreFont(serviceId);

      // Update local state
      setAppliedFonts((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });

      // Clear selection too
      if (serviceId === "Kakao Games") setSelectedFontKakao("");
      if (serviceId === "GGG") setSelectedFontGGG("");

      setOperationResult("success");
      setTimeout(() => setOperationResult(null), 3000);
    } catch (err: unknown) {
      const error = err as Error;
      if (!error.message?.includes("UAC")) {
        setOperationResult("error");
        setErrorDetail(error.message || String(err));
      } else {
        setOperationResult(null);
      }
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  if (!isVisible) return null;

  const isKakaoRunning = kakaoGameStatus.status === "running";
  const isGGGRunning = gggGameStatus.status === "running";

  return (
    <div
      className={`font-modal-overlay ${isVisible ? "visible" : ""}`}
      onClick={handleClose}
    >
      <div
        className={`font-modal ${isVisible ? "visible" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="font-loading-overlay">
            <div className="font-loading-content">
              <div className="font-spinner"></div>
              <div className="font-loading-text">
                <h3>잠시만 기다려 주세요...</h3>
                <p>{loadingMessage}</p>
                <div className="font-loading-sub">
                  작업이 진행되는 동안 런처를 종료하지 마세요.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Result Overlay */}
        {operationResult && (
          <div className={`font-result-overlay ${operationResult}`}>
            <div className="font-result-content">
              <span className="material-symbols-outlined font-result-icon">
                {operationResult === "success" ? "check_circle" : "error"}
              </span>
              <h3>
                {operationResult === "success" ? "작업 완료" : "작업 실패"}
              </h3>
              <p>
                {operationResult === "success"
                  ? "설정이 성공적으로 반영되었습니다."
                  : errorDetail}
              </p>
              <button
                className="font-btn"
                onClick={() => setOperationResult(null)}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* Header (Aligned with Settings Style) */}
        <div className="font-header">
          <h2>커스텀 폰트 관리</h2>
          <button onClick={handleClose} className="font-close-x">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="font-content">
          <div className="font-row-container">
            {/* Kakao Games Block */}
            <div className="font-service-card">
              <div className="font-service-header">
                <h3>Kakao Games 환경 설정</h3>
                {appliedFonts["Kakao Games"] && (
                  <span className="font-status-badge">커스텀 적용됨</span>
                )}
              </div>

              <div className="font-service-controls">
                <select
                  className="font-select"
                  value={selectedFontKakao}
                  onChange={(e) => setSelectedFontKakao(e.target.value)}
                  disabled={isLoading || isKakaoRunning}
                >
                  <option value="">기본값</option>
                  {fonts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.alias}
                    </option>
                  ))}
                  {/* Handle 'unknown' font situation */}
                  {appliedFonts["Kakao Games"] &&
                    !fonts.some(
                      (f) => f.id === appliedFonts["Kakao Games"],
                    ) && (
                      <option value={appliedFonts["Kakao Games"]}>
                        알 수 없는 폰트 (설치됨)
                      </option>
                    )}
                </select>
                <div className="font-btn-group">
                  <button
                    className="font-btn primary"
                    onClick={() =>
                      handleApplyFont("Kakao Games", selectedFontKakao)
                    }
                    disabled={
                      isLoading ||
                      isKakaoRunning ||
                      !selectedFontKakao ||
                      selectedFontKakao === appliedFonts["Kakao Games"]
                    }
                  >
                    {selectedFontKakao === appliedFonts["Kakao Games"] &&
                    selectedFontKakao !== ""
                      ? "현재 적용됨"
                      : "적용"}
                  </button>
                  {(selectedFontKakao || appliedFonts["Kakao Games"]) && (
                    <button
                      className="font-btn danger"
                      onClick={() => handleRestoreFont("Kakao Games")}
                      disabled={isLoading || isKakaoRunning}
                    >
                      복구
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* GGG Block */}
            <div className="font-service-card">
              <div className="font-service-header">
                <h3>GGG (Global) 환경 설정</h3>
                {appliedFonts["GGG"] && (
                  <span className="font-status-badge">커스텀 적용됨</span>
                )}
              </div>

              <div className="font-service-controls">
                <select
                  className="font-select"
                  value={selectedFontGGG}
                  onChange={(e) => setSelectedFontGGG(e.target.value)}
                  disabled={isLoading || isGGGRunning}
                >
                  <option value="">기본값</option>
                  {fonts.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.alias}
                    </option>
                  ))}
                  {/* Handle 'unknown' font situation */}
                  {appliedFonts["GGG"] &&
                    !fonts.some((f) => f.id === appliedFonts["GGG"]) && (
                      <option value={appliedFonts["GGG"]}>
                        알 수 없는 폰트 (설치됨)
                      </option>
                    )}
                </select>
                <div className="font-btn-group">
                  <button
                    className="font-btn primary"
                    onClick={() => handleApplyFont("GGG", selectedFontGGG)}
                    disabled={
                      isLoading ||
                      isGGGRunning ||
                      !selectedFontGGG ||
                      selectedFontGGG === appliedFonts["GGG"]
                    }
                  >
                    {selectedFontGGG === appliedFonts["GGG"] &&
                    selectedFontGGG !== ""
                      ? "현재 적용됨"
                      : "적용"}
                  </button>
                  {(selectedFontGGG || appliedFonts["GGG"]) && (
                    <button
                      className="font-btn danger"
                      onClick={() => handleRestoreFont("GGG")}
                      disabled={isLoading || isGGGRunning}
                    >
                      복구
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="font-section" style={{ flex: 1, marginTop: "12px" }}>
            <div className="font-section-title">
              <span>내 폰트 목록</span>
              <div className="font-library-actions">
                <button
                  className="font-control-inline-btn"
                  onClick={() =>
                    window.electronAPI.font.openCustomFontsFolder()
                  }
                  title="폰트 폴더 열기"
                >
                  <span className="material-symbols-outlined">folder_open</span>
                  <span>폴더 열기</span>
                </button>
                <button
                  className="font-control-inline-btn primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <span className="material-symbols-outlined">add</span>
                  <span>새 폰트 추가</span>
                </button>
              </div>
            </div>

            <input
              type="file"
              accept=".ttf,.otf"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFontFileSelect}
            />

            <div className="font-library-list">
              {fonts.length === 0 ? (
                <div className="font-empty-state">
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "48px",
                      color: "#333",
                      marginBottom: "8px",
                      display: "block",
                    }}
                  >
                    format_size
                  </span>
                  등록된 커스텀 폰트가 없습니다.
                  <br />
                  <small
                    style={{
                      color: "#555",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    [새 폰트 추가] 버튼을 눌러 .ttf 또는 .otf 파일을 등록하세요.
                  </small>
                </div>
              ) : (
                fonts.map((f) => (
                  <div className="font-library-item" key={f.id}>
                    <div className="font-library-info">
                      <div className="font-item-header">
                        <span className="font-library-name">{f.alias}</span>
                        <span className="font-library-file">{f.fileName}</span>
                      </div>

                      {f.previewDataUrl && (
                        <div className="font-preview-popover">
                          <img
                            src={f.previewDataUrl}
                            alt="Font Preview"
                            className="font-preview-img"
                          />
                        </div>
                      )}
                    </div>
                    {f.isDefault ? (
                      <span className="font-default-badge">기본값</span>
                    ) : (
                      <button
                        className="font-icon-btn danger"
                        onClick={(e) => handleDeleteFont(f.id, e)}
                        disabled={isLoading}
                        title="삭제"
                      >
                        <span className="material-symbols-outlined">
                          delete
                        </span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FontManagerModal;
