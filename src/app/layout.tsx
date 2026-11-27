import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = "https://webpconverter.bytelabstech.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "WebP Converter by ByteLabs | Free PNG & JPG to WebP",
    template: "%s | WebP Converter by ByteLabs",
  },
  description:
    "WebP Converter by ByteLabs is a free online tool to convert PNG and JPG images to WebP. Optimize image size, adjust quality, compare results, and download instantly. No sign-up and no ads.",
  applicationName: "WebP Converter",
  keywords: [
    "webpconverter",
    "webp converter",
    "ByteLabs",
    "Byte Labs",
    "PNG to WebP",
    "JPG to WebP",
    "JPEG to WebP",
    "online image converter",
    "free WebP converter",
    "image optimization",
    "compress images",
  ],
  category: "technology",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "WebP Converter by ByteLabs",
    title: "WebP Converter by ByteLabs | Free PNG & JPG to WebP",
    description:
      "Convert PNG and JPG images to WebP online with adjustable quality and instant downloads. Private by design, no sign-up, no ads.",
  },
  twitter: {
    card: "summary",
    title: "WebP Converter by ByteLabs",
    description:
      "Free online PNG and JPG to WebP converter. Adjust quality, compare file sizes, and download instantly.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
