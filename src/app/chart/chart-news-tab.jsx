import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ChartNewsTab({ t, symbol, newsLoading, news }) {
  if (newsLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm mb-2">{t('news')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-3 w-32 rounded-full" />
                <div className="h-4 w-24 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!news || news.length === 0) {
    return (
      <Card>
        <CardContent className="text-xs text-muted-foreground">
          {t('noNews', { symbol })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {news.slice(0, 10).map((item, idx) => {
        const title = item.title || '—';
        const publisher = item.publisher || '—';
        const time = item.providerPublishTime ? new Date(item.providerPublishTime).toLocaleDateString('en-US') : '—';
        const link = item.link || '#';
        const thumbnail = item.thumbnail?.resolutions?.[0]?.url || null;

        return (
          <Card
            key={idx}
            className="hover:cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
            style={{ cursor: 'pointer' }}
          >
            <CardHeader className="flex items-start gap-3 px-1 pb-2">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- external RSS thumbnails, arbitrary domains; Image optimizer can't serve them
                <img
                  src={thumbnail}
                  alt={title}
                  className="rounded-lg w-14 h-14 object-cover flex-shrink-0"
                />
              ) : null}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xs font-medium text-foreground truncate line-clamp-2">{title}</CardTitle>
                <CardDescription className="text-[0.7rem] text-muted-foreground mt-1">
                  {publisher} • {time}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              <p className="text-[0.75rem] text-muted-foreground line-clamp-2">
                {item.description || ''}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
