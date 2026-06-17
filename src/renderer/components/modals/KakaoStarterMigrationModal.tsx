import React, { useState } from "react";

import type { KakaoGameStarterMigrationRequest } from "../../../shared/types";
import "../ui/ConfirmModal.css";

interface KakaoStarterMigrationModalProps {
  request: KakaoGameStarterMigrationRequest | null;
  onInstall: () => Promise<boolean>;
  onClose: () => void;
}

const KakaoStarterMigrationModal: React.FC<KakaoStarterMigrationModalProps> = ({
  request,
  onInstall,
  onClose,
}) => {
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!request) return null;

  const handlePrimary = async () => {
    setErrorMsg("");
    setProcessing(true);

    try {
      const success = await onInstall();

      if (success) {
        onClose();
        return;
      }

      setErrorMsg(
        "설치 링크를 열지 못했습니다. 아래 주소를 브라우저에서 열어 주세요.",
      );
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "요청 처리 중 오류가 발생했습니다.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="confirm-modal-overlay">
      <div
        className="confirm-modal-content variant-primary"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "540px" }}
      >
        <div className="confirm-modal-header">
          <h2 className="confirm-title">카카오게임 스타터 설치 필요</h2>
        </div>
        <div className="confirm-modal-body">
          <p className="confirm-message" style={{ whiteSpace: "pre-line" }}>
            DaumGameStarter가 설치되어 있습니다.
            {"\n\n"}
            현재 카카오 게임 실행에는 카카오게임 스타터가 필요합니다. 설치
            링크를 열어 최신 스타터를 설치해 주세요.
            {"\n\n"}
            <small style={{ color: "#aaa", wordBreak: "break-all" }}>
              {request.installerUrl}
            </small>
            {errorMsg && (
              <>
                {"\n\n"}
                <span style={{ color: "#f48771", fontWeight: "bold" }}>
                  {errorMsg}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="confirm-modal-actions">
          <button
            className="btn-confirm-secondary"
            onClick={onClose}
            disabled={processing}
          >
            나중에
          </button>
          <button
            className="btn-confirm-primary btn-primary"
            onClick={handlePrimary}
            disabled={processing}
          >
            {processing ? "처리 중..." : "설치 링크 열기"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KakaoStarterMigrationModal;
