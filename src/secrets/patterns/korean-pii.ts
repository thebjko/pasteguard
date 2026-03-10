import type { PatternDetector, SecretLocation, SecretsMatch } from "./types";
import { detectPattern } from "./utils";

/**
 * Korean PII detector
 *
 * Detects:
 * - KOREAN_RRN: 주민등록번호 (920101-1234567)
 * - KOREAN_PASSPORT: 여권번호 (M12345678)
 * - KOREAN_DRIVERS_LICENSE: 운전면허번호 (11-00-000000-00)
 * - KOREAN_BANK_ACCOUNT: 계좌번호 (110-123-456789)
 */
export const koreanPiiDetector: PatternDetector = {
  patterns: ["KOREAN_RRN", "KOREAN_PASSPORT", "KOREAN_DRIVERS_LICENSE", "KOREAN_BANK_ACCOUNT"],

  detect(text: string, enabledTypes: Set<string>) {
    const matches: SecretsMatch[] = [];
    const locations: SecretLocation[] = [];

    // 주민등록번호: 앞 6자리-뒤 7자리 (뒷자리 첫 번째는 1~4)
    if (enabledTypes.has("KOREAN_RRN")) {
      const rrnPattern = /\b\d{6}-[1-4]\d{6}\b/g;
      detectPattern(text, rrnPattern, "KOREAN_RRN", matches, locations);
    }

    // 여권번호: 영문 1자리 + 숫자 8자리
    if (enabledTypes.has("KOREAN_PASSPORT")) {
      const passportPattern = /\b[A-Z][0-9]{8}\b/g;
      detectPattern(text, passportPattern, "KOREAN_PASSPORT", matches, locations);
    }

    // 운전면허번호: XX-XX-XXXXXX-XX
    if (enabledTypes.has("KOREAN_DRIVERS_LICENSE")) {
      const licensePattern = /\b\d{2}-\d{2}-\d{6}-\d{2}\b/g;
      detectPattern(text, licensePattern, "KOREAN_DRIVERS_LICENSE", matches, locations);
    }

    // 계좌번호: 하이픈으로 구분된 10~14자리 숫자 (신한: 110-123-456789, 농협: 352-1234-5678-03 등)
    if (enabledTypes.has("KOREAN_BANK_ACCOUNT")) {
      const accountPattern = /\b\d{3,4}-\d{3,4}-\d{4,6}(?:-\d{2})?\b/g;
      detectPattern(text, accountPattern, "KOREAN_BANK_ACCOUNT", matches, locations);
    }

    return {
      detected: matches.length > 0,
      matches,
      locations: locations.length > 0 ? locations : undefined,
    };
  },
};
