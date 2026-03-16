import type { PatternDetector, SecretLocation, SecretsMatch } from "./types";
import { detectPattern } from "./utils";

/**
 * Korean ID detector
 *
 * Detects:
 * - KOREAN_RRN: 주민등록번호 (6 digits + hyphen + 7 digits, optional spaces around hyphen)
 */
export const koreanIdsDetector: PatternDetector = {
  patterns: ["KOREAN_RRN"],

  detect(text: string, enabledTypes: Set<string>) {
    const matches: SecretsMatch[] = [];
    const locations: SecretLocation[] = [];

    if (enabledTypes.has("KOREAN_RRN")) {
      // 000000-0000000 with optional spaces around the hyphen
      // Negative lookaround ensures it's not part of a longer digit sequence
      const rrnPattern = /(?<!\d)\d{6}\s*-\s*\d{7}(?!\d)/g;
      detectPattern(text, rrnPattern, "KOREAN_RRN", matches, locations);
    }

    return {
      detected: matches.length > 0,
      matches,
      locations: locations.length > 0 ? locations : undefined,
    };
  },
};
