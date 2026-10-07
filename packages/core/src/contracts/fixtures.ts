import type { IntentFrame, Advisory } from './types';

export const intentFrameFixture: IntentFrame = {
  raw: "ಈ ವಾರ ನೀರು ಹಾಯಿಸಬೇಕಾ?",
  normalized: "ಈ ವಾರ ನೀರು ಹಾಯಿಸಬೇಕಾ",
  lang: "kn",
  script: "KANNADA_SCRIPT",
  intent: "irrigation_advice",
  intentConfidence: 0.94,
  slots: {
    date_range: { value: "2026-08-14 to 2026-08-20", normalized: "2026-08-14" }
  },
  needsClarification: [],
  profileDefaultsUsed: ["taluk", "sowing_date", "irrigation_type"]
};

export const advisoryFixture: Advisory = {
  intent: "irrigation_advice",
  headline: "IRRIGATE",
  facts: [
    { label: "soil_depletion", value: 60, unit: "mm", source: "FAO-56 Water Balance" }
  ],
  confidence: "HIGH",
  evidence: {
    ruleIds: ["irrigation_rule_v1"],
    featureSnapshot: { "D_today": 60, "RAW": 50 }
  },
  cautions: ["Do not irrigate if rain exceeds 20mm in next 3 days."],
  nextCheck: "2026-08-25",
  templateId: "irrigation_action_kn"
};
