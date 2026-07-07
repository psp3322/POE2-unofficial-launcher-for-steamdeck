!include "FileFunc.nsh"

!macro customInit
  ; [SteamDeck] 스팀 바로가기가 이 설치파일(setup.exe)을 그대로 다시 실행했을 때,
  ; 이미 설치된 런처가 있으면 재설치 대신 런처를 바로 실행한다.
  ; 스팀덱에서 compatdata (랜덤숫자) 폴더를 찾아 바로가기 경로를 수정하는
  ; 수작업을 없애기 위한 처리다.
  ; 예외: electron-updater 자동 업데이트는 --updated 인자(또는 /S 무음 설치)로
  ; 설치파일을 실행하므로 이 경우에는 반드시 설치를 진행해야 한다.
  ; (스텁이 가로채면 업데이트가 영원히 적용되지 않는 무한 루프에 빠진다)
  IfSilent steamdeckStubDone
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  IfErrors 0 steamdeckStubDone
  SetRegView 64
  ReadRegStr $R2 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  StrCmp $R2 "" steamdeckStubDone
  IfFileExists "$R2\${PRODUCT_FILENAME}.exe" 0 steamdeckStubDone
  SetOutPath "$R2"
  Exec '"$R2\${PRODUCT_FILENAME}.exe"'
  Quit
steamdeckStubDone:

  ; Check if the app is running and kill it before installation
  DetailPrint "Checking for running instance..."
  ExecWait 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T' $R0
  Sleep 1000
!macroend

!macro customInstall
  ; Add custom install logic here if needed
!macroend

!macro customUnInit
  ; Check if the app is running and kill it using taskkill (Plugin-free)
  DetailPrint "Checking for running instance..."
  ExecWait 'taskkill /F /IM "${PRODUCT_FILENAME}.exe" /T' $R0
  Sleep 1000

  ; [Cleaned] No extra logic here.
  ; Verification: UAC disable logic moved to customUnInstall to support reinstall/update scenarios.
!macroend

!macro customUnInstall
  ; 3. Ask user about deleting AppData (Settings, Logs, Cache)
  MessageBox MB_ICONQUESTION|MB_YESNO "설정 파일 및 사용자 데이터(%AppData%\${PRODUCT_FILENAME})를 모두 삭제하시겠습니까?$\n(로그인 정보와 자동화 설정이 모두 초기화됩니다.)" /SD IDNO IDNO skip_appdata_cleanup
    DetailPrint "Cleaning up AppData..."

    ; [New] Run UAC cleanup script if exists (Only when user agrees to full wipe)
    ; This ensures UAC settings are kept during reinstall/update (where user usually says NO to data wipe)
    IfFileExists "$APPDATA\${PRODUCT_FILENAME}\daumgamestarter_uac\uninstall_uac.bat" 0 skip_uac_cleanup
      DetailPrint "Removing UAC Bypass settings..."
      ExecWait '"$APPDATA\${PRODUCT_FILENAME}\daumgamestarter_uac\uninstall_uac.bat"'
    skip_uac_cleanup:

    ; Attempt to remove actual data path
    RMDir /r "$APPDATA\${PRODUCT_FILENAME}"
  skip_appdata_cleanup:
!macroend
