# AGENTS-ROADMAP.md — 개발 내부 로드맵 (마일스톤 + DoD + 검증)

> 에이전트·개발 내부용 엔지니어링 로드맵: 개발 도구, 빌드/CI, 리팩토링,
> 기술부채, 에이전트 워크플로. 사용자에게 보이는 제품 로드맵은
> `docs/Roadmap.md`(CI가 Issue #7·gh-pages 공지로 동기화)가 별도로 담당한다.
> 이 파일은 CI와 무관하며 공개 채널에 노출되지 않는다. 라우팅 규칙:
> `.agents/skills/roadmap-capture/SKILL.md`.

## 백로그

- [ ] husky pre-commit: WSL 감지 시 lint-staged를 Windows pwsh로 위임
      — DoD: WSL에서 `git commit`이 `--no-verify` 없이 통과 / 검증: WSL 실커밋
      1회 `[WSL]` + Windows 커밋 회귀 없음 `[Windows-pwsh]`.
      의사코드: `docs/archive/2026-05-20-residual-work.md` §2.5.
