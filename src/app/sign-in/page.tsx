import { AuthForm } from "@/components/auth-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-4 py-12 sm:px-6">
      <AuthForm mode="sign-in" />
    </main>
  );
}
