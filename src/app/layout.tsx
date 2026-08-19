import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Nunito, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { currentIsAdmin } from "@/lib/admin";
import { clerkAppearance, CLERK_TASK_URLS } from "@/lib/clerk-options";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.spiritvalemods.com"),
  title: "SpiritVale Mods",
  description: "Official catalog of SpiritVale mods and Mod Manager releases.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/ui/icon-shop.png", type: "image/png" },
    ],
    apple: "/icon.png",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const isAdmin = publishableKey ? await currentIsAdmin() : false;
  const body = (
    <>
      <SiteHeader clerkEnabled={Boolean(publishableKey)} isAdmin={isAdmin} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </>
  );

  return (
    <html
      lang="en"
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`${nunito.className} flex min-h-full flex-col bg-background text-foreground`}>
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/upload"
            signUpFallbackRedirectUrl="/upload"
            afterSignOutUrl="/"
            taskUrls={CLERK_TASK_URLS}
            appearance={clerkAppearance}
            unsafe_disableDevelopmentModeConsoleWarning
          >
            {body}
          </ClerkProvider>
        ) : (
          body
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
