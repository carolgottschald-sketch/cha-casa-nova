import "./globals.css";
export const metadata = { title: "Chá de Casa Nova · Carol & Ray", description: "Ajude a montar o nosso lar com um presente via Pix." };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="pt-BR"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Nunito:wght@400;600&display=swap" rel="stylesheet" />
  </head><body>{children}</body></html>);
}
