import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Codelabs Environment",
  description: "Interactive Codelabs Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark"> {/* Enable dark mode by default */}
      {/* Correctly apply font className */}
      <body className={inter.className}>
        <main className="min-h-screen bg-background text-foreground">
           {/* Simple wrapper, can add Header/Footer later */}
          {children}
        </main>
      </body>
    </html>
  );
}
