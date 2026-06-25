import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider as GlobalAuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "ระบบจองห้องนันทนาการ อบจ.พะเยา",
  description: "ระบบจองห้องพักผ่อนและจัดการคิวแบบ Real-time",
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', (event) => {
                if (event.filename && (event.filename.indexOf('chrome-extension') > -1 || event.filename.indexOf('moz-extension') > -1)) {
                  event.stopImmediatePropagation();
                }
              }, true);
              window.addEventListener('unhandledrejection', (event) => {
                if (event.reason && event.reason.stack && (event.reason.stack.indexOf('chrome-extension') > -1 || event.reason.stack.indexOf('moz-extension') > -1)) {
                  event.stopImmediatePropagation();
                }
              }, true);
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <GlobalAuthProvider>
          {children}
        </GlobalAuthProvider>
      </body>
    </html>
  );
}
