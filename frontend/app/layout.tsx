export const metadata = { title: 'CineMatch', description: 'Find your next favorite film.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
