export async function GET() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Aruna';
  
  const manifest = {
    name: `${appName}`,
    short_name: appName,
    description: "Analyzing seasonal patterns in seconds",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#121212",
    orientation: "portrait",
    icons: [
      {
        src: "/aruna.png",
        sizes: "any",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/aruna.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/aruna.png",
        sizes: "512x512",
        type: "image/png"
      }
    ],
    categories: ["finance", "productivity"]
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
