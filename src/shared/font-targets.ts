/**
 * 폰트 변조 및 시스템 등록을 위한 타겟 정보 정의 (Source of Truth)
 * 
 * - 테스트 코드(generate-kakao-fonts.ts)에서 검증된 정밀 메타데이터 규격을 따릅니다.
 * - GGG(Global) 및 Kakao Games(KR) 서비스별로 타겟 폰트 패밀리를 정의합니다.
 */

export interface FontMutationRule {
  family: string;
  subfamily: string;
  fullName: string;
  postScript: string;
}

/**
 * 폰트 메타데이터 변조 상세 규격
 */
export const FONT_MUTATION_DEFINITIONS: Record<string, FontMutationRule> = {
  // GGG (Global Path of Exile 2)
  "Fontin": {
    family: "Fontin",
    subfamily: "Regular",
    fullName: "Fontin",
    postScript: "Fontin-Regular",
  },
  "Fontin SmallCaps": {
    family: "Fontin SmallCaps",
    subfamily: "Regular",
    fullName: "Fontin SmallCaps",
    postScript: "FontinSmallCaps-Regular",
  },

  // Kakao Games (Korean Path of Exile 2)
  "Noto Sans CJK TC Book": {
    family: "Noto Sans CJK TC",
    subfamily: "Book",
    fullName: "Noto Sans CJK TC",
    postScript: "NotoSansCJKTC",
  },
  "Spoqa Han Sans Neo Regular": {
    family: "Spoqa Han Sans Neo",
    subfamily: "Regular",
    fullName: "Spoqa Han Sans Neo Regular",
    postScript: "SpoqaHanSansNeo-Regular",
  },
};

/**
 * 서비스별 타겟 폰트 매핑
 * - UI 및 배프 패치 로직에서 사용됩니다.
 */
export const TARGET_SERVICES_CONFIG: Record<string, string[]> = {
  "GGG": ["Fontin", "Fontin SmallCaps"],
  "Kakao Games": ["Noto Sans CJK TC Book", "Spoqa Han Sans Neo Regular"],
};
