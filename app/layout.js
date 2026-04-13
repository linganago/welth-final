import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../components/header";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Welth",
  description: "One stop Finance Platform",
};

// ---------------------------------------------------------------------------
// CI / build safety
// ---------------------------------------------------------------------------
// Clerk validates NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY at module-load time during
// `next build`. If the value is absent or a placeholder the build crashes with:
//   "The publishableKey passed to Clerk is invalid"
//
// During CI builds we set NEXT_PUBLIC_CI_BUILD=true so we can render a minimal
// shell without ClerkProvider — this prevents the prerender crash while still
// allowing the build to type-check and bundle all pages.
//
// In production (Vercel) and local dev, NEXT_PUBLIC_CI_BUILD is never set, so
// ClerkProvider is always used normally.
// ---------------------------------------------------------------------------
const IS_CI_BUILD = process.env.NEXT_PUBLIC_CI_BUILD === "true";

export default function RootLayout({ children }) {
  // During CI build: wrap in a plain div instead of ClerkProvider.
  // Auth-dependent UI (Header's SignedIn/SignedOut) renders nothing without
  // Clerk context, which is fine — we only care that the build succeeds.
  if (IS_CI_BUILD) {
    return (
      <html lang="en">
        <head>
          <link rel="icon" href="/logo-sm.png" sizes="any" />
        </head>
        <body className={inter.className}>
          <main className="min-h-screen">{children}</main>
          <Toaster richColors />
        </body>
      </html>
    );
  }

  return (
    <ClerkProvider fallbackRedirectUrl="/dashboard">
      <html lang="en">
        <head>
          <link rel="icon" href="/logo-sm.png" sizes="any" />
        </head>
        <body className={inter.className}>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Toaster richColors />

          <footer className="bg-blue-50 py-12">
            <div className="container mx-auto px-4 text-center text-gray-600">
              <p>Manage Finance with Intelligence</p>
            </div>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}
