import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function ChartProfileTab({
  t,
  symbol,
  fundamentalsLoading,
  fundamentals,
  formatQuoteType,
  formatMarketState,
  formatTimestamp,
}) {
  if (fundamentalsLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('companyProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="h-3 w-20 rounded-full" />
                <div className="h-4 w-24 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileInfo = fundamentals?.profile;
  const extendedProfile = fundamentals?.assetProfile;
  if (!profileInfo && !extendedProfile) {
    return (
      <Card>
        <CardContent className="text-xs text-muted-foreground">
          {t('companyProfileUnavailable', { symbol })}
        </CardContent>
      </Card>
    );
  }

  const locationParts = [extendedProfile?.address1, extendedProfile?.city, extendedProfile?.state, extendedProfile?.country].filter(Boolean);
  const headquarters = locationParts.join(', ');
  const websiteRaw = extendedProfile?.website;
  const website = websiteRaw ? (websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`) : null;
  const officers = Array.isArray(extendedProfile?.companyOfficers) ? extendedProfile.companyOfficers.filter((officer) => officer?.name).slice(0, 6) : []; 
  const governance = fundamentals?.governance;

  const keyFacts = [
    { label: t('exchange'), value: profileInfo?.exchange },
    { label: t('quoteType'), value: formatQuoteType(profileInfo?.quoteType) },
    { label: t('marketState'), value: formatMarketState(profileInfo?.marketState) },
    { label: t('sector'), value: extendedProfile?.sector || profileInfo?.sector },
    { label: t('industry'), value: extendedProfile?.industry || profileInfo?.industry },
    { label: t('country'), value: extendedProfile?.country || null },
    { label: t('phone'), value: extendedProfile?.phone || null },
    { label: t('employees'), value: extendedProfile?.fullTimeEmployees != null ? Number(extendedProfile.fullTimeEmployees).toLocaleString('en-US') : null },
    { label: t('headquarters'), value: headquarters || null },
    { label: t('website'), value: website ? <a href={website} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{websiteRaw}</a> : null },
    { label: t('investorRelations'), value: extendedProfile?.irWebsite ? <a href={extendedProfile.irWebsite} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{t('irSite')}</a> : null },
  ].filter((item) => item.value);

  return (
    <div className="space-y-4">
      {keyFacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm mb-2">{t('companyProfile')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              {keyFacts.map((fact) => (
                <div key={fact.label} className="space-y-1">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="text-xs font-medium text-foreground">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
      {extendedProfile?.longBusinessSummary && <Card className="mt-4 pt-4"><CardHeader><CardTitle className="text-sm mb-2">{t('companyBackground')}</CardTitle></CardHeader><CardContent><p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">{extendedProfile.longBusinessSummary}</p></CardContent></Card>}
      {governance && Object.values(governance).some((value) => value != null) && <Card className="mt-4 pt-4"><CardHeader><CardTitle className="text-sm mb-2">{t('governanceRisk')}</CardTitle></CardHeader><CardContent><div className="space-y-3">{[{ label: t('overallRisk'), value: governance.overallRisk }, { label: t('auditRisk'), value: governance.auditRisk }, { label: t('boardRisk'), value: governance.boardRisk }, { label: t('compensationRisk'), value: governance.compensationRisk }, { label: t('shareholderRights'), value: governance.shareHolderRightsRisk }].filter((item) => item.value != null).map((item) => { const score = Number(item.value); const pct = Math.min(100, (score / 10) * 100); const color = score <= 3 ? 'bg-emerald-500' : score <= 6 ? 'bg-amber-500' : 'bg-red-500'; const textColor = score <= 3 ? 'text-emerald-500' : score <= 6 ? 'text-amber-500' : 'text-red-500'; return <div key={item.label} className="space-y-1"><div className="flex justify-between text-xs"><span className="text-muted-foreground">{item.label}</span><span className={`font-bold ${textColor}`}>{score} / 10</span></div><Progress value={pct} className="h-1.5 bg-muted" indicatorClassName={color} /></div>; })}{governance.governanceEpochDate && <p className="text-2xs text-muted-foreground pt-1">{t('asOf', { date: formatTimestamp(Number(governance.governanceEpochDate) * 1000, { dateOnly: true }) ?? '—' })}</p>}</div></CardContent></Card>}
      {officers.length > 0 && <Card className="mt-4 pt-4"><CardHeader><CardTitle className="text-sm mb-2">{t('leadership')}</CardTitle></CardHeader><CardContent className="space-y-3">{officers.map((officer, idx) => <div key={`${officer.name}-${idx}`} className=""><p className="text-xs font-semibold dark:text-white/70 text-black/70">{officer.name}</p><p className="text-xs text-muted-foreground">{officer.title || t('executive')}</p></div>)}</CardContent></Card>}
    </div>
  );
}
