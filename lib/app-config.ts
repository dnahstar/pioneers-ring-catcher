// *** Configurable variables for the app ***
// This file contains all the user-editable configuration values that can be updated when customizing the chatbot app.

export const APP_CONFIG = {
  // UPDATE: Set to the welcome message for the chatbot
  WELCOME_MESSAGE:
    "⭕ 링 챌린지: 고리를 사수하라!",

  // UPDATE: Set to the name of the chatbot app
  NAME: "Ring Catcher",

  // UPDATE: Set to the description of the chatbot app
  DESCRIPTION: "하늘에서 쏟아지는 알록달록한 고리들을 막대에 정확히 끼워 넣어 가장 높은 점수를 기록하세요!",
} as const;

// Colors Configuration - UPDATE THESE VALUES BASED ON USER DESIGN PREFERENCES
export const COLORS = {
  // UPDATE: Set to the background color (hex format)
  BACKGROUND: "#FFFFFF",

  // UPDATE: Set to the primary color for buttons, links, etc. (hex format)
  PRIMARY: "#4B73FF",
} as const;
