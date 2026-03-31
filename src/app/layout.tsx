import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthProvider"; // Assuming it should be AuthContext, wait, let me check the existing import.
// Existing was imports { AuthProvider } from "@/context/AuthContext";
import { AuthProvider as GlobalAuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "ระบบจองห้องนันทนาการ อบจ.พะเยา",
  description: "ระบบจองห้องพะเยาคอนเซนเตอร์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <GlobalAuthProvider>
          {children}
        </GlobalAuthProvider>
      </body>
    </html>
  );
}
