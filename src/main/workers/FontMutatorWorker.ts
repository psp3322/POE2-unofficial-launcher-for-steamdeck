import fs from "node:fs";
import { parentPort } from "node:worker_threads";

import { Font } from "fonteditor-core";

/**
 * [Phase 1] 폰트 메타데이터 변조 워커 (Precision Mutator)
 *
 * - fonteditor-core를 사용하여 Name Table(ID 1, 2, 4, 6, 16, 17)을 정밀 주입합니다.
 * - 모든 타겟 메타데이터는 상단 MUTATION_RULES에 정의되어 관리가 용이합니다.
 */

import { FontMutationRule } from "../../shared/font-targets";

interface MutatorMessage {
  filePath: string;
  rule: FontMutationRule;
}

if (parentPort) {
  parentPort.on("message", (data: MutatorMessage) => {
    const { filePath, rule } = data;

    try {
      if (!rule) {
        throw new Error("변조 규칙(rule) 객체가 전달되지 않았습니다.");
      }

      // 1. 폰트 로드
      const buffer = fs.readFileSync(filePath);
      const font = Font.create(buffer, { type: "ttf" });
      const fontData = font.get();
      const name = fontData.name;

      // 2. Name Table 주입 (ID 1, 2, 4, 6, 16, 17)
      // 모든 언어 레코드(en, ko 등)를 동일하게 맞춰 윈도우 타이틀 중복/깨짐 방지
      name.fontFamily = rule.family; // ID 1
      name.fontSubFamily = rule.subfamily; // ID 2
      name.fullName = rule.fullName; // ID 4
      name.postScriptName = rule.postScript; // ID 6
      name.preferredFamily = rule.family; // ID 16
      name.preferredSubFamily = rule.subfamily; // ID 17

      // Unique ID (ID 3) 생성
      name.uniqueSubFamily = `${rule.postScript};${name.version || "1.000"}`;

      // 3. 변조된 버퍼 생성 및 반환
      const outputData = font.write({ type: "ttf" });
      const finalBuffer = Buffer.from(outputData as Uint8Array);

      // Transferable로 넘기기 위해 ArrayBuffer 추출
      const arrayBuffer = finalBuffer.buffer.slice(
        finalBuffer.byteOffset,
        finalBuffer.byteOffset + finalBuffer.byteLength,
      );

      parentPort?.postMessage(
        {
          success: true,
          buffer: arrayBuffer,
        },
        [arrayBuffer as ArrayBuffer],
      );
    } catch (e: unknown) {
      parentPort?.postMessage({
        error: (e as Error).message || "변조 과정 중 알 수 없는 오류 발생",
      });
    }
  });
}
