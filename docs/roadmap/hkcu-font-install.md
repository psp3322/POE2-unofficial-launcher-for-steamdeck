# 폰트 설치 HKLM → HKCU 전환

`installSystemFont`가 HKLM(`%windir%\Fonts`) 전용이라 항상 관리자 권한 필요.
Windows 1809+ 표준 HKCU(`%LOCALAPPDATA%\Microsoft\Windows\Fonts`) 설치로
전환하면 UAC 불필요.

- 선결 리스크: 게임/패치가 HKCU 등록 폰트를 실제 인식하는지 검증
  (미해소 시 "설치됐는데 게임이 못 읽음" 회귀). admin 세션의 HKCU 하이브
  오인 논점 포함.
- 안전망: 제거/정리는 이미 양쪽 하이브 스윕 (B-1차 완료).
- 상세 계획: `docs/archive/font-analysis/bugfix-hkcu-font-removal-plan.md` §8.
