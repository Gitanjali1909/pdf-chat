import './global.css'
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning> 
      <body className="bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}