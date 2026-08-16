import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import commonEn from '../../messages/en/common.json';
import watchlistEn from '../../messages/en/watchlist.json';
import exploreEn from '../../messages/en/explore.json';
import accountEn from '../../messages/en/account.json';
import chartEn from '../../messages/en/chart.json';
import portfolioEn from '../../messages/en/portfolio.json';
import msciEn from '../../messages/en/msci.json';
import toolsEn from '../../messages/en/tools.json';
import idxBubblesEn from '../../messages/en/idxBubbles.json';
import idxMomentumEn from '../../messages/en/idxMomentum.json';
import idxRotationEn from '../../messages/en/idxRotation.json';
import discussionEn from '../../messages/en/discussion.json';
import signinEn from '../../messages/en/signin.json';
import offlineEn from '../../messages/en/offline.json';
import moneyFlowEn from '../../messages/en/moneyFlow.json';
import desktopNavbarEn from '../../messages/en/desktopNavbar.json';
import symbolSearchEn from '../../messages/en/symbolSearch.json';
import modeToggleEn from '../../messages/en/modeToggle.json';
import clearDataEn from '../../messages/en/clearData.json';
import pwaInstallEn from '../../messages/en/pwaInstall.json';
import componentsEn from '../../messages/en/components.json';

import commonId from '../../messages/id/common.json';
import watchlistId from '../../messages/id/watchlist.json';
import exploreId from '../../messages/id/explore.json';
import accountId from '../../messages/id/account.json';
import chartId from '../../messages/id/chart.json';
import portfolioId from '../../messages/id/portfolio.json';
import msciId from '../../messages/id/msci.json';
import toolsId from '../../messages/id/tools.json';
import idxBubblesId from '../../messages/id/idxBubbles.json';
import idxMomentumId from '../../messages/id/idxMomentum.json';
import idxRotationId from '../../messages/id/idxRotation.json';
import discussionId from '../../messages/id/discussion.json';
import signinId from '../../messages/id/signin.json';
import offlineId from '../../messages/id/offline.json';
import moneyFlowId from '../../messages/id/moneyFlow.json';
import desktopNavbarId from '../../messages/id/desktopNavbar.json';
import symbolSearchId from '../../messages/id/symbolSearch.json';
import modeToggleId from '../../messages/id/modeToggle.json';
import clearDataId from '../../messages/id/clearData.json';
import pwaInstallId from '../../messages/id/pwaInstall.json';
import componentsId from '../../messages/id/components.json';

const en = {
  ...commonEn,
  ...watchlistEn,
  ...exploreEn,
  ...accountEn,
  ...chartEn,
  ...portfolioEn,
  ...msciEn,
  ...toolsEn,
  ...idxBubblesEn,
  ...idxMomentumEn,
  ...idxRotationEn,
  ...discussionEn,
  ...signinEn,
  ...offlineEn,
  ...moneyFlowEn,
  ...desktopNavbarEn,
  ...symbolSearchEn,
  ...modeToggleEn,
  ...clearDataEn,
  ...pwaInstallEn,
  ...componentsEn,
};

const id = {
  ...commonId,
  ...watchlistId,
  ...exploreId,
  ...accountId,
  ...chartId,
  ...portfolioId,
  ...msciId,
  ...toolsId,
  ...idxBubblesId,
  ...idxMomentumId,
  ...idxRotationId,
  ...discussionId,
  ...signinId,
  ...offlineId,
  ...moneyFlowId,
  ...desktopNavbarId,
  ...symbolSearchId,
  ...modeToggleId,
  ...clearDataId,
  ...pwaInstallId,
  ...componentsId,
};

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('locale')?.value === 'id' ? 'id' : 'en';

  return {
    locale,
    messages: locale === 'id' ? id : en,
  };
});
