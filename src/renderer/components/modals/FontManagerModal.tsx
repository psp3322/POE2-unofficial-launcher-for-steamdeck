import React, { useEffect, useState, useRef } from "react";
import { AppConfig, CustomFontData, GameStatusState } from "../../../shared/types";
import { useGameState } from "../../contexts/GameStateContext";
import "./FontManagerModal.css";

interface FontManagerModalProps {
  isVisible: boolean;
  onClose: () => void;
  gameId: AppConfig["activeGame"];
}

const FontManagerModal: React.FC<FontManagerModalProps> = ({ isVisible, onClose, gameId }) => {
  const [fonts, setFonts] = useState<CustomFontData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
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
    } else {
      setSelectedFontKakao("");
      setSelectedFontGGG("");
    }
  }, [isVisible, gameId, syncGameState]);

  const handleClose = () => {
    onClose();
  };

  const handleFontFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      await window.electronAPI.font.addFont(file.path);
      await fetchFonts();
    } catch (err: any) {
      alert(`폰트 등록 실패: ${err.message || String(err)}`);
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

  const handleApplyFont = async (serviceId: AppConfig["serviceChannel"], selectedFontId: string) => {
    if (!selectedFontId) {
      return alert("적용할 폰트를 선택해주세요.");
    }
    
    setIsLoading(true);
    try {
      await window.electronAPI.font.applyFont(serviceId, selectedFontId);
      alert(`${serviceId} 서비스에 폰트가 성공적으로 적용되었습니다.\n게임에 재접속하면 반영됩니다.`);
    } catch (err: any) {
      if (err.message?.includes("UAC")) {
         console.warn("UAC Denied");
      } else {
         alert(`적용 중 오류가 발생했습니다: ${err.message || String(err)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreFont = async (serviceId: AppConfig["serviceChannel"]) => {
    if (!confirm(`정말로 ${serviceId}의 폰트 설정을 기본값으로 복구하시겠습니까?`)) return;
    setIsLoading(true);
    try {
      await window.electronAPI.font.restoreFont(serviceId);
      alert("기본 폰트로 복구되었습니다.");
    } catch (err: any) {
      if (!err.message?.includes("UAC")) {
        alert(`복구 중 오류가 발생했습니다: ${err.message || String(err)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  const isKakaoRunning = kakaoGameStatus.status === "running";
  const isGGGRunning = gggGameStatus.status === "running";

  return (
    <div className={`font-modal-overlay ${isVisible ? "visible" : ""}`} onClick={handleClose}>
      <div className="font-modal settings-modal-like" onClick={(e) => e.stopPropagation()}>
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
                <span className="font-status-badge">
                  {isKakaoRunning ? "게임 실행 중" : "사용 가능"}
                </span>
              </div>
              
              <div className="font-service-controls">
                <select 
                  className="font-select" 
                  value={selectedFontKakao} 
                  onChange={(e) => setSelectedFontKakao(e.target.value)}
                  disabled={isLoading || isKakaoRunning || fonts.length === 0}
                >
                  <option value="">적용할 폰트를 선택하세요</option>
                  {fonts.map(f => (
                    <option key={`kakao-${f.id}`} value={f.id}>{f.alias}</option>
                  ))}
                </select>
                <div className="font-btn-group">
                  <button 
                    className="font-btn primary" 
                    onClick={() => handleApplyFont("Kakao Games", selectedFontKakao)} 
                    disabled={isLoading || !selectedFontKakao || isKakaoRunning}
                  >
                    적용하기
                  </button>
                  <button 
                    className="font-btn danger" 
                    onClick={() => handleRestoreFont("Kakao Games")} 
                    disabled={isLoading || isKakaoRunning}
                    title="기본값 폰트로 복원"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>restart_alt</span>
                  </button>
                </div>
              </div>
            </div>

            {/* GGG Block */}
            <div className="font-service-card">
              <div className="font-service-header">
                <h3>GGG (Global) 환경 설정</h3>
                <span className="font-status-badge">
                  {isGGGRunning ? "게임 실행 중" : "사용 가능"}
                </span>
              </div>
              
              <div className="font-service-controls">
                <select 
                  className="font-select" 
                  value={selectedFontGGG} 
                  onChange={(e) => setSelectedFontGGG(e.target.value)}
                  disabled={isLoading || isGGGRunning || fonts.length === 0}
                >
                  <option value="">적용할 폰트를 선택하세요</option>
                  {fonts.map(f => (
                    <option key={`ggg-${f.id}`} value={f.id}>{f.alias}</option>
                  ))}
                </select>
                <div className="font-btn-group">
                  <button 
                    className="font-btn primary" 
                    onClick={() => handleApplyFont("GGG", selectedFontGGG)} 
                    disabled={isLoading || !selectedFontGGG || isGGGRunning}
                  >
                    적용하기
                  </button>
                  <button 
                    className="font-btn danger" 
                    onClick={() => handleRestoreFont("GGG")} 
                    disabled={isLoading || isGGGRunning}
                    title="기본값 폰트로 복원"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>restart_alt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="font-section" style={{ flex: 1, marginTop: "12px" }}>
            <div className="font-section-title">
              <span>로컬 폰트 라이브러리</span>
              <div className="font-library-actions">
                <button 
                  className="font-control-inline-btn" 
                  onClick={() => window.electronAPI.font.openCustomFontsFolder()}
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
                  <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#333", marginBottom: "8px", display: "block" }}>format_size</span>
                  등록된 커스텀 폰트가 없습니다.<br/>
                  <small style={{ color: "#555", marginTop: "4px", display: "block" }}>
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
                          <img src={f.previewDataUrl} alt="Font Preview" className="font-preview-img" />
                        </div>
                      )}
                    </div>
                    <button 
                      className="font-icon-btn danger" 
                      onClick={(e) => handleDeleteFont(f.id, e)}
                      disabled={isLoading}
                      title="삭제"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
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

