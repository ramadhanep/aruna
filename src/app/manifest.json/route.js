const resolveOrigin = () => {
  const fallback = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  try {
    return new URL(fallback).origin;
  } catch {
    return 'http://localhost:3000';
  }
};

export async function GET() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Aruna';
  const version = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
  const origin = resolveOrigin();

  const manifest = {
    id: '/',
    name: appName,
    short_name: appName,
    description: 'Seasonality, screeners, and price context built for active investors.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    launch_handler: { client_mode: 'auto' },
    handle_links: 'preferred',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    categories: ['finance', 'productivity', 'business'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/aruna.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/aruna.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Seasonal Chart',
        short_name: 'Chart',
        description: 'Jump directly to the election-cycle chart view.',
        url: '/chart?cycle=normal',
        icons: [{ src: '/aruna.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Screeners',
        short_name: 'Explore',
        description: 'Review the latest IDX, US, and crypto signals.',
        url: '/',
        icons: [{ src: '/aruna.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'MSCI Tracker',
        short_name: 'MSCI',
        description: 'Track Indonesian stocks following MSCI indices.',
        url: '/msci',
        icons: [{ src: '/aruna.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Money Flow',
        short_name: 'Flow',
        description: 'Monitor broker accumulation and weekly top picks.',
        url: '/money-flow',
        icons: [{ src: '/aruna.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Portfolio tracker',
        short_name: 'Portfolio',
        description: 'Update your holdings while offline.',
        url: '/portfolio-tracker',
        icons: [{ src: '/aruna.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
    screenshots: [
      {
        src: `${origin}/aruna.png`,
        sizes: '1024x1024',
        type: 'image/png',
        form_factor: 'wide',
      },
    ],
    edge_side_panel: {
      preferred_width: 380,
    },
    version,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
