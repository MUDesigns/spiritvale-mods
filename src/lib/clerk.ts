export function hasClerk(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY?.trim());
}
