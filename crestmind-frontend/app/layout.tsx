import type { Metadata } from 'next'
import { DM_Sans, DM_Serif_Display, DM_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const dmSans = DM_Sans({ 
  subsets: ["latin"],
  variable: '--font-dm-sans'
})

const dmSerif = DM_Serif_Display({ 
  subsets: ["latin"],
  weight: "400",
  variable: '--font-dm-serif'
})

const dmMono = DM_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: '--font-dm-mono'
})

export const metadata: Metadata = {
  title: 'CrestMind AI | Property Document Intelligence',
  description: 'AI-Powered Answers from Property Documents - Woodcrest Capital',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${dmSerif.variable} ${dmMono.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          themes={["dark", "light", "green", "midnight"]}
          storageKey="crestmind-theme"
          disableTransitionOnChange={false}
        >
          {children}
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: 'rgba(20, 18, 16, 0.9)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(201, 168, 76, 0.15)',
                color: '#f0ead8',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
              },
              classNames: {
                success: 'border-success/30',
                error: 'border-destructive/30',
              },
            }}
          />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}