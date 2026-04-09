/**
 * Renderer-side Font Preview Generator
 * HTML5 Canvas를 사용하여 등록 시점에 폰트 썸네일(PNG)을 생성합니다.
 */
export class FontPreviewGenerator {
  /**
   * 폰트 파일(Blob/File)로부터 미리보기 이미지를 생성하여 Base64(DataURL)로 반환합니다.
   */
  public static async generatePreview(fontFile: File): Promise<string> {
    const fontName = "temp-preview-font-" + Date.now();
    const fontUrl = URL.createObjectURL(fontFile);

    try {
      // 1. 렌더러에 폰트 동적 등록
      const fontFace = new FontFace(fontName, `url(${fontUrl})`);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);

      // 2. Canvas 생성 및 렌더링 (800x120)
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Could not get canvas context");

      // 디자인 가이드 준수 (투명 배경 + 흰색 외곽선 + 어두운 채우기)
      const text = "Path of Exile 2 - 한글 테스트";
      const fontSize = 48;

      ctx.clearRect(0, 0, 800, 120);
      ctx.font = `${fontSize}px "${fontName}"`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      const x = 20;
      const y = 60;

      // 외곽선 없이 깔끔하게 텍스트만 채우기
      ctx.fillStyle = "#1a1a1a"; // 검은색 글씨
      ctx.fillText(text, x, y);

      // 3. 결과물 추출
      const dataUrl = canvas.toDataURL("image/png");

      // Cleanup
      document.fonts.delete(loadedFace);

      return dataUrl;
    } catch (err) {
      console.error("Failed to generate font preview in renderer:", err);
      return "";
    } finally {
      URL.revokeObjectURL(fontUrl);
    }
  }
}
