import type { PatternDetector, SecretLocation, SecretsMatch } from "./types";

const DEFAULT_SENSITIVE_FIELDS = [
  // 인증/비밀
  "password", "passwd", "pwd", "passphrase",
  "secret", "private_key", "access_key",
  // 개인 식별
  "ssn", "social_security", "national_id", "resident_number",
  "rrn", "주민번호", "주민등록번호",
  "passport", "passport_number",
  "drivers_license", "license_number",
  // 금융
  "account_number", "account_no", "bank_account",
  "credit_card", "card_number",
  "salary", "income", "wage", "compensation",
  "tax_id", "ein",
  // 기타
  "date_of_birth", "dob", "birth_date", "birthday",
  "mother_maiden_name",
];

/**
 * 키-값 쌍에서 민감한 필드명을 찾아 값만 마스킹한다.
 *
 * YAML:  ssn: 920101-1234567
 * TOML:  salary = 85000000
 * JSON:  "account_number": "110-123-456789"
 */
export function createFieldValuesDetector(extraFields: string[] = []): PatternDetector {
  const allFields = [...DEFAULT_SENSITIVE_FIELDS, ...extraFields];

  const escaped = allFields.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // 매칭: [key][?whitespace][:=][?whitespace][?quote][value][?quote]
  // value 캡처 그룹(1)만 location으로 반환
  const source = `(?:^|[,{\\[\\n])\\s*["']?(?:${escaped})["']?\\s*[:=]\\s*["']?([^\\s"',\\]\\}\\n]{2,})["']?`;

  return {
    patterns: ["FIELD_SENSITIVE_VALUE"],

    detect(text: string, enabledTypes: Set<string>) {
      if (!enabledTypes.has("FIELD_SENSITIVE_VALUE")) {
        return { detected: false, matches: [] };
      }

      const matches: SecretsMatch[] = [];
      const locations: SecretLocation[] = [];
      const pattern = new RegExp(source, "gim");

      for (const match of text.matchAll(pattern)) {
        if (match.index === undefined || !match[1]) continue;

        const valueOffset = match[0].lastIndexOf(match[1]);
        const valueStart = match.index + valueOffset;
        const valueEnd = valueStart + match[1].length;

        locations.push({ start: valueStart, end: valueEnd, type: "FIELD_SENSITIVE_VALUE" });
      }

      if (locations.length > 0) {
        matches.push({ type: "FIELD_SENSITIVE_VALUE", count: locations.length });
      }

      return {
        detected: matches.length > 0,
        matches,
        locations: locations.length > 0 ? locations : undefined,
      };
    },
  };
}

export const fieldValuesDetector = createFieldValuesDetector();
