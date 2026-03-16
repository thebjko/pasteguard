import type { PatternDetector, SecretLocation, SecretsMatch } from "./types";
import { detectPattern } from "./utils";

/**
 * Korean ID detector
 *
 * Detects:
 * - KOREAN_RRN: 주민등록번호 (6 digits + hyphen + 7 digits, optional spaces around hyphen)
 * - KOREAN_PHONE: 한국 전화번호 (3가지 앞자리 조합 × 2가지 중간자리, optional spaces around hyphens)
 *   Formats: 000-000-0000, 00-000-0000, 00-0000-0000, 000-0000-0000
 */
export const koreanIdsDetector: PatternDetector = {
  patterns: ["KOREAN_RRN", "KOREAN_PHONE"],

  detect(text: string, enabledTypes: Set<string>) {
    const matches: SecretsMatch[] = [];
    const locations: SecretLocation[] = [];

    if (enabledTypes.has("KOREAN_RRN")) {
      // 000000-0000000 with optional spaces around the hyphen
      // Negative lookaround ensures it's not part of a longer digit sequence
      const rrnPattern = /(?<!\d)\d{6}\s*-\s*\d{7}(?!\d)/g;
      detectPattern(text, rrnPattern, "KOREAN_RRN", matches, locations);
    }

    if (enabledTypes.has("KOREAN_PHONE")) {
      // 000-000-0000, 00-000-0000, 00-0000-0000, 000-0000-0000
      // First group: 2-3 digits, second group: 3-4 digits, third group: exactly 4 digits
      const phonePattern = /(?<!\d)\d{2,3}\s*-\s*\d{3,4}\s*-\s*\d{4}(?!\d)/g;
      detectPattern(text, phonePattern, "KOREAN_PHONE", matches, locations);
    }

    return {
      detected: matches.length > 0,
      matches,
      locations: locations.length > 0 ? locations : undefined,
    };
  },
};
