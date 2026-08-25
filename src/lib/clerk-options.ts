export const CLERK_TASK_PATH = "/sign-in/tasks";

export const CLERK_TASK_URLS = {
  "reset-password": CLERK_TASK_PATH,
  "setup-mfa": CLERK_TASK_PATH,
  "choose-organization": CLERK_TASK_PATH,
} as const;

export const USERNAME_MIN = 4;
export const USERNAME_MAX = 64;

export const clerkAppearance = {
  variables: {
    colorPrimary: "#d4a8ff",
    colorBackground: "#12081c",
    colorForeground: "#f6f1ff",
    colorMutedForeground: "#b9a8d4",
    colorInputBackground: "#050308",
    colorInputForeground: "#f6f1ff",
    colorNeutral: "#b9a8d4",
    borderRadius: "0.75rem",
  },
};
