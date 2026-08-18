import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-extrabold">Upload a mod</h1>
        <p className="mt-2 text-sm text-[#9aa3b8]">
          Zip only, 50 MB max. Your file stays private until VirusTotal reports it
          clean. Add a description so people know what they are installing. Scripts
          can use an{" "}
          <a href="/account" className="font-bold text-[#55b7ea] hover:underline">
            API key
          </a>{" "}
          — see the{" "}
          <a
            href="https://github.com/MUDesigns/spiritvale-mod-devkit"
            className="font-bold text-[#55b7ea] hover:underline"
          >
            upload API devkit
          </a>
          .
        </p>
      </div>
      <div className="panel p-6">
        <UploadForm />
      </div>
    </main>
  );
}
