// commitlint.config.js — 커밋 규약(AGENTS.md `## 개발 워크플로` > 커밋 규약)의
// 기계적 강제. 형식·type-enum만 검사하며, "타입=사용자 영향"·"제목=사용자
// 관점" 같은 의미 규칙은 린터가 못 잡으므로 규율로 지킨다.
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // release-please(`release-please-config.json`)의 타입 집합과 일치시킨다.
    // config-conventional 기본값엔 없는 커스텀 타입 `internal`을 허용.
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "perf",
        "docs",
        "chore",
        "internal",
        "revert",
      ],
    ],
    // 한국어 제목·고유명사(KakaoGames, UpdateModal, PathOfExile_KG 등) 허용.
    "subject-case": [0],
    // 여러 줄 한국어 본문/푸터의 줄 길이 제한 해제. 이슈 참조(#N) 이후 줄은
    // conventionalcommits 파서가 footer로 분류하므로 body와 대칭 해제
    // (실례: 0f415a7 본문의 #24439 참조 줄).
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
  },
};
