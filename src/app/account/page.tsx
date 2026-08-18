import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/account-panel";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-extrabold">Account</h1>
        <p className="mt-2 text-sm text-[#9aa3b8]">
          Profile, password, connected accounts, and API keys for the catalog upload API.
        </p>
      </div>
      <AccountPanel />
    </main>
  );
}
