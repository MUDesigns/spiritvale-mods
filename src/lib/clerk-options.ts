export const CLERK_TASK_PATH = "/sign-in/tasks";

export const CLERK_TASK_URLS = {
  "reset-password": CLERK_TASK_PATH,
  "setup-mfa": CLERK_TASK_PATH,
  "choose-organization": CLERK_TASK_PATH,
} as const;

export const clerkAppearance = {
  variables: {
    colorPrimary: "#55b7ea",
    colorBackground: "#1a1f2c",
    colorForeground: "#f4f7fb",
    colorMutedForeground: "#9aa3b8",
    colorInputBackground: "#12151f",
    colorInputForeground: "#f4f7fb",
    colorNeutral: "#9aa3b8",
    borderRadius: "0.75rem",
  },
};
