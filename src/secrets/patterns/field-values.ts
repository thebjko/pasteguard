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
  // 한국 급여 (본봉/수당/공제)
  "본봉", "정근수당가산금", "정근수당추가가산금", "대우공무원수당",
  "정액급식비", "직급보조비", "필수요원수당", "관리업무수당", "육아휴직수당",
  "보전수당", "교직수당", "교직가산원로", "교직가산보직", "교직가산담임",
  "교직가산보건", "교직가산특별", "기술정보수당", "가족수당", "초과근무수당",
  "교직수당가산금8", "교원연구비", "교직수당가산금10", "특수직무수당",
  "소득세", "지방소득세", "연말정산소득세", "연말정산지방소득세",
  "일반기여금", "합산반납금", "일반과미납금", "건강보험", "노인장기요양보험",
  "국민연금", "고용보험", "교직원공제회비", "대여학자금", "교원연합회비",
  "상조회비", "중등행정실장회비", "친목회비", "기타공제",
  "수당총액", "공제총액", "지급총금액",
  // 한국 급여 (공무직 추가)
  "기본급", "근속수당", "자격가산금", "특수지원수당", "특수업무수당",
  "연차유급휴가미사용수당", "연장근로수당", "면허수당", "위험수당",
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
