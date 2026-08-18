import { AuthForm } from "@/components/auth-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <AuthForm mode="sign-in" />
    </main>
  );
}
