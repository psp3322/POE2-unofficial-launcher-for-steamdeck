import React, { useEffect, useState, useMemo } from "react";

import { AppConfig, UnifiedFontData } from "../../../shared/types";
import { useGameState } from "../../contexts/GameStateContext";
import { Toast } from "../ui/Toast";
import "./FontManagerModal.css";

interface FontManagerModalProps {
  isVisible: boolean;
  onClose: () => void;
  gameId: AppConfig["activeGame"];
}

type ServiceKey = "Kakao Games" | "GGG";

const FontManagerModal: React.FC<FontManagerModalProps> = ({
  isVisible,
  onClose,
  gameId,
}) => {
  const [fonts, setFonts] = useState<UnifiedFontData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  // 현재 에디팅 중인 폰트 ID 및 별명
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // 서비스별 할당 상태 (로컬 변경 추적용)
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [selectedFontId, setSelectedFontId] = useState<string>("DEFAULT");
  const [hoveredFontId, setHoveredFontId] = useState<string | null>(null);

  // Toast State
  const [toastMsg, setToastMsg] = useState("");
  const [toastVariant, setToastVariant] = useState<"default" | "success" | "warning" | "error" | "white">("default");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Confirm Modal State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteAlias, setPendingDeleteAlias] = useState("");

  const modalRef = React.useRef<HTMLDivElement>(null);
  const { getActiveGameState, syncGameState } = useGameState();

  const isKakaoRunning = getActiveGameState(gameId, "Kakao Games").status === "running";
  const isGGGRunning = getActiveGameState(gameId, "GGG").status === "running";

  const sortedFonts = useMemo(() => {
    return [...fonts].sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [fonts]);

  const displayFont = useMemo(() => {
    const targetId = hoveredFontId || selectedFontId;
    return fonts.find(f => f.id === targetId) || fonts.find(f => f.isDefault);
  }, [fonts, selectedFontId, hoveredFontId]);

  // 초기 상태 대비 변경 여부 확인 (적용 버튼 활성화 기준)
  const isDirty = useMemo(() => {
    return Object.entries(assignments).some(([service, fontId]) => {
      const currentAppliedFont = fonts.find(f => f.appliedServices?.includes(service));
      const currentAppliedId = currentAppliedFont ? currentAppliedFont.id : "DEFAULT";
      return fontId !== currentAppliedId;
    });
  }, [assignments, fonts]);

  const fetchFonts = async () => {
    try {
      const data = await window.electronAPI.font.getUnifiedFonts();
      setFonts(data);
      
      const initialAssignments: Record<string, string | null> = {
        "Kakao Games": "DEFAULT",
        "GGG": "DEFAULT"
      };
      data.forEach(f => {
        f.appliedServices?.forEach(s => {
          initialAssignments[s] = f.id;
        });
      });
      setAssignments(initialAssignments);
    } catch (e) {
      console.error("Failed to fetch fonts", e);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchFonts();
      syncGameState(gameId, "Kakao Games");
      syncGameState(gameId, "GGG");
    }
  }, [isVisible, gameId, syncGameState]);

  useEffect(() => {
    const removeHandler = window.electronAPI.font.onFontUpdated(() => {
      fetchFonts();
    });
    return () => removeHandler();
  }, []);

  const handleToggleAssignment = (e: React.MouseEvent, service: ServiceKey, fontId: string) => {
    e.stopPropagation(); // 행 선택 방지
    if (service === "Kakao Games" && isKakaoRunning) return;
    if (service === "GGG" && isGGGRunning) return;

    setAssignments(prev => ({
      ...prev,
      [service]: fontId
    }));
  };

  const showToast = (msg: string, variant: "default" | "success" | "warning" | "error" | "white" = "default") => {
    setToastMsg(msg);
    setToastVariant(variant);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  };

  const handleApply = async () => {
    setIsLoading(true);
    setLoadingMessage("변경 사항을 시스템에 반영하고 있습니다...");
    try {
      await window.electronAPI.font.applyBatch(assignments);
      await fetchFonts();
      showToast("변경 사항이 성공적으로 적용되었습니다.", "success");
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`적용 중 오류가 발생했습니다: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleAddFont = async () => {
    setIsLoading(true);
    setLoadingMessage("폰트 파일을 선택하고 있습니다...");
    try {
      const filePath = await window.electronAPI.font.pickFontFile();
      if (!filePath) {
        // 취소된 경우
        setIsLoading(false);
        return;
      }

      setLoadingMessage("폰트 정보를 분석하고 등록하는 중입니다...");
      await window.electronAPI.font.addFont(filePath);
      await fetchFonts();
      showToast("새 폰트가 라이브러리에 추가되었습니다.", "success");
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`폰트 등록 중 오류가 발생했습니다: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  };

  const handleDeleteFont = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const font = fonts.find(f => f.id === id);
    if (!font) return;
    
    if (font.appliedServices && font.appliedServices.length > 0) {
      return showToast("현재 서비스에 할당된 폰트는 삭제할 수 없습니다. '기본값'으로 변경 후 삭제해 주세요.", "warning");
    }

    setPendingDeleteId(id);
    setPendingDeleteAlias(font.alias);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    
    setIsLoading(true);
    setShowDeleteConfirm(false);
    try {
      await window.electronAPI.font.removeFont(pendingDeleteId);
      await fetchFonts();
      showToast("폰트가 삭제되었습니다.", "success");
    } catch (err) {
      console.error(err);
      showToast("삭제 중 오류가 발생했습니다.", "error");
    } finally {
      setIsLoading(false);
      setPendingDeleteId(null);
      setPendingDeleteAlias("");
    }
  };

  const startEdit = (e: React.MouseEvent, id: string, currentAlias: string, isDefault?: boolean) => {
    e.stopPropagation();
    if (isDefault) return;
    setEditingId(id);
    setEditValue(currentAlias);
  };

  const submitEdit = async () => {
    if (!editingId) return;
    try {
      await window.electronAPI.font.updateAlias(editingId, editValue);
    } catch (e: unknown) {
      const error = e as Error;
      showToast(error.message, "error");
    } finally {
      setEditingId(null);
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`font-modal-overlay ${isVisible ? "visible" : ""}`} onClick={onClose}>
      <div className={`font-modal ${isVisible ? "visible" : ""}`} ref={modalRef} onClick={(e) => e.stopPropagation()}>
        
        {/* Shared Toast Notification */}
        <Toast 
          message={toastMsg}
          visible={toastVisible}
          container={modalRef.current}
          variant={toastVariant}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="font-loading-overlay">
            <div className="font-loading-content">
              <div className="font-spinner"></div>
              <div className="font-loading-text">
                <h3>{loadingMessage}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="font-header">
          <h2>커스텀 폰트 관리</h2>
          <button onClick={onClose} className="font-close-x">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Selected/Hovered Font Preview (Top) */}
        <div className="font-top-preview-section">
          {displayFont?.previewDataUrl ? (
            <img src={displayFont.previewDataUrl} alt="Preview" className="font-preview-main-img" />
          ) : (
            <span className="font-preview-placeholder">
              {displayFont?.isDefault ? "기본 시스템 폰트는 미리보기를 제공하지 않습니다." : "미리보기를 생성할 수 없는 폰트입니다."}
            </span>
          )}
          <div className="font-preview-info">
            {displayFont ? `${displayFont.alias} (${displayFont.originalName})` : "폰트를 선택해 주세요."}
          </div>
        </div>

        <div className="font-content">
          <div className="font-matrix-header">
            <span>별칭</span>
            <span>폰트명</span>
            <span>카카오게임즈</span>
            <span>GGG</span>
            <span>삭제</span>
          </div>

          <div className="font-list-container" onMouseLeave={() => setHoveredFontId(null)}>
            {sortedFonts.map((f) => {
              const isDefaultRow = f.id === "DEFAULT";
              const isActiveKakao = assignments["Kakao Games"] === f.id;
              const isActiveGGG = assignments["GGG"] === f.id;
              const isSelected = selectedFontId === f.id;

              return (
                <div 
                  key={f.id} 
                  className={`font-matrix-row ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedFontId(f.id)}
                  onMouseEnter={() => setHoveredFontId(f.id)}
                >
                  
                  {/* Alias Cell */}
                  <div className={`font-alias-cell ${f.isDefault ? "readonly" : ""}`} onClick={(e) => startEdit(e, f.id, f.alias, f.isDefault)}>
                    {editingId === f.id ? (
                      <input 
                        autoFocus
                        className="font-alias-input"
                        value={editValue}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={submitEdit}
                        onKeyDown={(e) => e.key === "Enter" && submitEdit()}
                      />
                    ) : (
                      <span className={`font-alias-text ${isDefaultRow ? "font-label-default" : ""}`}>
                        {f.alias}
                      </span>
                    )}
                  </div>

                  {/* Font Name Cell */}
                  <div className="font-original-name-cell">
                    <span className="font-original-name">{f.originalName}</span>
                  </div>

                  {/* Kakao Radio Column */}
                  <div className="font-radio-cell">
                    <div 
                      className={`font-radio-wrapper ${isActiveKakao ? "active" : ""}`}
                      onClick={(e) => handleToggleAssignment(e, "Kakao Games", f.id)}
                    >
                      <div className="font-radio-indicator"></div>
                    </div>
                  </div>

                  {/* GGG Radio Column */}
                  <div className="font-radio-cell">
                    <div 
                      className={`font-radio-wrapper ${isActiveGGG ? "active" : ""}`}
                      onClick={(e) => handleToggleAssignment(e, "GGG", f.id)}
                    >
                      <div className="font-radio-indicator"></div>
                    </div>
                  </div>

                    {/* Delete Cell */}
                    <div className="font-delete-cell">
                      {f.isDefault ? (
                        <button className="font-delete-btn disabled" title="런처에 기본 내장된 폰트입니다." disabled>
                          <span className="material-symbols-outlined">delete_forever</span>
                        </button>
                      ) : (
                        <button className="font-delete-btn" onClick={(e) => handleDeleteFont(e, f.id)}>
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      )}
                    </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="font-footer">
          <div className="font-library-actions">
            <button className="font-btn secondary" onClick={handleAddFont} disabled={isLoading}>
              <span className="material-symbols-outlined">add_circle</span>
              <span>새 폰트 추가</span>
            </button>
            <button className="font-btn secondary" onClick={() => window.electronAPI.font.openCustomFontsFolder()} title="폴더 열기">
              <span className="material-symbols-outlined">folder_open</span>
            </button>
          </div>

          <div className="font-main-actions">
            <button 
              className="font-btn primary" 
              onClick={handleApply} 
              disabled={!isDirty || isLoading}
            >
              <span className="material-symbols-outlined">check_circle</span>
              <span>적용</span>
            </button>
          </div>
        </div>

        {/* Custom Confirm Modal for Deletion */}
        {showDeleteConfirm && (
          <div className="confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-header">폰트 삭제 확인</div>
              <div className="confirm-body">
                '<strong>{pendingDeleteAlias}</strong>' 항목을 정말 삭제하시겠습니까?<br/>
                <small style={{ color: "#888", display: "inline-block", marginTop: "8px" }}>
                  (이 작업은 되돌릴 수 없습니다.)
                </small>
              </div>
              <div className="confirm-footer">
                <button className="confirm-btn cancel" onClick={() => setShowDeleteConfirm(false)}>취소</button>
                <button className="confirm-btn primary" onClick={confirmDelete}>삭제하기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FontManagerModal;
