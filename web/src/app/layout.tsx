// Il layout vero (con <html>) è in app/[locale]/layout.tsx.
// Questo file serve solo perché Next.js richiede un layout alla radice.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
