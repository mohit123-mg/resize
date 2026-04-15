export const metadata = {
  title: "Fast Image Compressor",
  description: "Shrink images to ~350KB while keeping resolution.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b0d10", color: "#e8eaed" }}>
        {children}
      </body>
    </html>
  );
}
