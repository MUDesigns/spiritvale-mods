import { AuthForm } from "@/components/auth-form";

export default function SignUpPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <AuthForm mode="sign-up" />
    </main>
  );
}
