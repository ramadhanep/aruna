-- Supabase schema for aruna app

-- Profiles table keeps a denormalised copy of auth metadata
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Stores the full watchlist payload per user
create table if not exists public.watchlists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Stores the entire portfolio document per user
create table if not exists public.portfolios (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.portfolios enable row level security;

-- Allow users to read and maintain their own profile row
create policy "Users can view profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can upsert profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Users can update profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Watchlist policies
create policy "Users manage their watchlist" on public.watchlists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Portfolio policies
create policy "Users manage their portfolio" on public.portfolios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helpful indexes for updated_at sorting if needed
create index if not exists watchlists_updated_at_idx on public.watchlists (updated_at desc);
create index if not exists portfolios_updated_at_idx on public.portfolios (updated_at desc);

-- Master stock/asset lists used by server-side screeners
create table if not exists public.stock_universes (
  id integer primary key default 1,
  idx_stocks text[] not null,
  us_stocks text[] not null,
  crypto_stocks text[] not null,
  updated_at timestamptz default now()
);

alter table public.stock_universes enable row level security;

create policy "Service role maintains universes" on public.stock_universes
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Stores the latest screening snapshot per category (IDX, US, CRYPTO)
create table if not exists public.screening_snapshots (
  category text primary key,
  results jsonb not null default '[]'::jsonb,
  status text not null default 'idle',
  next_cursor integer not null default 0,
  processed_count integer not null default 0,
  total_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

alter table public.screening_snapshots enable row level security;

create policy "Anyone can view screening results" on public.screening_snapshots
  for select using (true);

create policy "Service role maintains screening results" on public.screening_snapshots
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists screening_snapshots_updated_at_idx on public.screening_snapshots (updated_at desc);

-- Stores trending stocks by category (IDX, US, CRYPTO) for marquee display
create table if not exists public.trending_stocks (
  category text not null,
  symbol text not null,
  "order" integer not null default 0,
  created_at timestamptz default now(),
  primary key (category, symbol)
);

alter table public.trending_stocks enable row level security;

create policy "Anyone can view trending stocks" on public.trending_stocks
  for select using (true);

create policy "Service role maintains trending stocks" on public.trending_stocks
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create index if not exists trending_stocks_category_order_idx on public.trending_stocks (category, "order");

insert into public.stock_universes (id, idx_stocks, us_stocks, crypto_stocks)
values (
  1,
  (select array_agg(value::text) from jsonb_array_elements_text('["ACST.JK", "ADES.JK", "ADMF.JK", "ADMG.JK", "AGII.JK", "AGRS.JK", "AHAP.JK", "AKPI.JK", "AKSI.JK", "ALDO.JK", "ALKA.JK", "AMAG.JK", "AMFG.JK", "AMIN.JK", "ANJT.JK", "APEX.JK", "APIC.JK", "APII.JK", "APLI.JK", "ARII.JK", "ARTA.JK", "ASBI.JK", "ASDM.JK", "ASJT.JK", "ASRM.JK", "ATIC.JK", "BABP.JK", "BAJA.JK", "BAPA.JK", "BBKP.JK", "BBLD.JK", "BBMD.JK", "BBRM.JK", "BCIP.JK", "BGTG.JK", "BIPI.JK", "BKSW.JK", "BMSR.JK", "BNBA.JK", "BOLT.JK", "BPFI.JK", "BPII.JK", "BRAM.JK", "BRNA.JK", "BSSR.JK", "BTON.JK", "BULL.JK", "BUVA.JK", "CEKA.JK", "CENT.JK", "CINT.JK", "CITA.JK", "CLPI.JK", "CPRO.JK", "CSAP.JK", "DART.JK", "DGIK.JK", "DKFT.JK", "DNAR.JK", "DNET.JK", "DPNS.JK", "DSFI.JK", "DVLA.JK", "DYAN.JK", "ECII.JK", "EKAD.JK", "EMDE.JK", "EPMT.JK", "ERTX.JK", "FAST.JK", "FMII.JK", "FORU.JK", "FPNI.JK", "GDST.JK", "GDYR.JK", "GEMA.JK", "GMTD.JK", "GOLD.JK", "GPRA.JK", "GSMF.JK", "GTBO.JK", "GWSA.JK", "GZCO.JK", "HDFA.JK", "HERO.JK", "HITS.JK", "IGAR.JK", "IKBI.JK", "IMJS.JK", "INAI.JK", "INCI.JK", "INDR.JK", "INDS.JK", "INDX.JK", "INPP.JK", "INRU.JK", "INTD.JK", "IPOL.JK", "ITMA.JK", "JAWA.JK", "JECC.JK", "JIHD.JK", "JRPT.JK", "JSPT.JK", "KAEF.JK", "KBLM.JK", "KBLV.JK", "KDSI.JK", "KICI.JK", "KOBX.JK", "KONI.JK", "KOPI.JK", "KPIG.JK", "KRAS.JK", "LEAD.JK", "LION.JK", "LMPI.JK", "LPCK.JK", "LPGI.JK", "LPIN.JK", "LPLI.JK", "LPPS.JK", "LRNA.JK", "MASA.JK", "MBAP.JK", "MBTO.JK", "MDLN.JK", "MERK.JK", "MFIN.JK", "MICE.JK", "MITI.JK", "MKPI.JK", "MLPT.JK", "MPPA.JK", "MRAT.JK", "MSKY.JK", "NELY.JK", "NIKL.JK", "NIRO.JK", "NOBU.JK", "OKAS.JK", "PALM.JK", "PDES.JK", "PEGE.JK", "PGLI.JK", "PICO.JK", "PJAA.JK", "PKPK.JK", "PNBS.JK", "PNSE.JK", "PSAB.JK", "PSDN.JK", "PTIS.JK", "PTSN.JK", "PTSP.JK", "PUDP.JK", "PYFA.JK", "RANC.JK", "RDTX.JK", "RELI.JK", "RIGS.JK", "ROTI.JK", "RUIS.JK", "SAFE.JK", "SCCO.JK", "SDPC.JK", "SDRA.JK", "SHID.JK", "SKBM.JK", "SKLT.JK", "SMAR.JK", "SMDM.JK", "SMMT.JK", "SOCI.JK", "SONA.JK", "SPMA.JK", "SRAJ.JK", "SRSN.JK", "SSTM.JK", "STTP.JK", "SULI.JK", "TALF.JK", "TBMS.JK", "TCID.JK", "TGKA.JK", "TIFA.JK", "TIRA.JK", "TMPO.JK", "TOTO.JK", "TPIA.JK", "TRIS.JK", "TRST.JK", "TRUS.JK", "UNIT.JK", "VINS.JK", "VOKS.JK", "VRNA.JK", "WAPO.JK", "WEHA.JK", "WIKA.JK", "WOMF.JK", "YULE.JK", "CASA.JK", "DAYA.JK", "DPUM.JK", "IDPR.JK", "KINO.JK", "OASA.JK", "PBSA.JK", "BOGA.JK", "PORT.JK", "MINA.JK", "CSIS.JK", "FIRE.JK", "KMTR.JK", "MAPB.JK", "HOKI.JK", "MPOW.JK", "MDKI.JK", "BELL.JK", "KIOS.JK", "MTWI.JK", "PPRE.JK", "WEGE.JK", "DWGL.JK", "JMAS.JK", "CAMP.JK", "IPCM.JK", "LCKM.JK", "HELI.JK", "INPS.JK", "GHON.JK", "DFAM.JK", "NICK.JK", "PRIM.JK", "TRUK.JK", "PZZA.JK", "TNCA.JK", "TCPI.JK", "RISE.JK", "BPTR.JK", "NFCX.JK", "MGRO.JK", "MOLI.JK", "PANI.JK", "CITY.JK", "SAPX.JK", "SURE.JK", "MPRO.JK", "CAKK.JK", "SATU.JK", "SOSS.JK", "DIVA.JK", "LUCK.JK", "URBN.JK", "SOTS.JK", "ZONE.JK", "PEHA.JK", "BEEF.JK", "CLAY.JK", "NATO.JK", "JAYA.JK", "COCO.JK", "JAST.JK", "FITT.JK", "CCSI.JK", "SFAN.JK", "POLU.JK", "KJEN.JK", "ITIC.JK", "PAMG.JK", "BLUE.JK", "EAST.JK", "LIFE.JK", "FUJI.JK", "INOV.JK", "SMKL.JK", "TFAS.JK", "OPMS.JK", "NZIA.JK", "SLIS.JK", "IRRA.JK", "DMMX.JK", "KEJU.JK", "AGAR.JK", "IFSH.JK", "IFII.JK", "PMJS.JK", "GLVA.JK", "AMAR.JK", "INDO.JK", "AMOR.JK", "TRIN.JK", "DMND.JK", "PTPW.JK", "IKAN.JK", "RONY.JK", "CSMI.JK", "BBSS.JK", "BHAT.JK", "TECH.JK", "UANG.JK", "PGUN.JK", "TRJA.JK", "SCNP.JK", "KMDS.JK", "PURI.JK", "SOHO.JK", "HOMI.JK", "PMMP.JK", "WIFI.JK", "FAPA.JK", "DCII.JK", "KETR.JK", "DGNS.JK", "UFOE.JK", "BANK.JK", "EDGE.JK", "SNLK.JK", "ZYRX.JK", "NPGF.JK", "ADCP.JK", "LABA.JK", "MASB.JK", "NICL.JK", "UVCR.JK", "HAIS.JK", "OILS.JK", "GPSO.JK", "SBMA.JK", "CMNT.JK", "KUAS.JK", "BOBA.JK", "DEPO.JK", "BINO.JK", "TAYS.JK", "OBMD.JK", "NASI.JK", "BSML.JK", "SEMA.JK", "ASLC.JK", "NETV.JK", "ENAK.JK", "NTBK.JK", "BIKE.JK", "WIRG.JK", "SICO.JK", "TLDN.JK", "SWID.JK", "ARKO.JK", "CHEM.JK", "DEWI.JK", "AXIO.JK", "KRYA.JK", "GULA.JK", "TOOL.JK", "BUAH.JK", "CRAB.JK", "MEDS.JK", "PRAY.JK", "CBUT.JK", "BSBK.JK", "KDTN.JK", "MMIX.JK", "VTNY.JK", "ELIT.JK", "BEER.JK", "CBPE.JK", "WINE.JK", "PEVE.JK", "LAJU.JK", "FWCT.JK", "VAST.JK", "HALO.JK", "FUTR.JK", "PTMP.JK", "TRON.JK", "NSSS.JK", "GTRA.JK", "AWAN.JK", "DOOH.JK", "JATI.JK", "TYRE.JK", "MPXL.JK", "KLAS.JK", "MAXI.JK", "VKTR.JK", "CRSN.JK", "INET.JK", "RMKO.JK", "FOLK.JK", "GRIA.JK", "PPRI.JK", "CYBR.JK", "MUTU.JK", "HUMI.JK", "RSCH.JK", "BABY.JK", "IOTF.JK", "KOCI.JK", "PTPS.JK", "STRK.JK", "KOKA.JK", "RGAS.JK", "IKPM.JK", "AYAM.JK", "SURI.JK", "ASLI.JK", "CGAS.JK", "NICE.JK", "MSJA.JK", "SMLE.JK", "ACRO.JK", "GRPH.JK", "SMGA.JK", "UNTD.JK", "TOSK.JK", "MPIX.JK", "MKAP.JK", "LIVE.JK", "HYGN.JK", "BAIK.JK", "VISI.JK", "AREA.JK", "MHKI.JK", "ATLA.JK", "DATA.JK", "SOLA.JK", "BATR.JK", "PART.JK", "ISEA.JK", "BLES.JK", "GUNA.JK", "LABS.JK", "DOSS.JK", "NEST.JK", "PTMR.JK", "VERN.JK", "BOAT.JK", "NAIK.JK", "KSIX.JK", "RATU.JK", "YOII.JK", "HGII.JK", "BRRC.JK", "OBAT.JK", "ASPR.JK", "COIN.JK", "MERI.JK", "CHEK.JK", "PMUI.JK", "KAQI.JK", "FORE.JK", "DKHH.JK", "AYLS.JK", "ASPI.JK", "ESTA.JK", "BESS.JK", "AMAN.JK", "CARE.JK", "AALI.JK", "ABMM.JK", "ACES.JK", "ADHI.JK", "ADRO.JK", "AGRO.JK", "AISA.JK", "AKRA.JK", "AMRT.JK", "ANTM.JK", "APLN.JK", "ARNA.JK", "ARTO.JK", "ASGR.JK", "ASII.JK", "ASRI.JK", "ASSA.JK", "AUTO.JK", "BACA.JK", "BALI.JK", "BAYU.JK", "BBCA.JK", "BBHI.JK", "BBNI.JK", "BBRI.JK", "BBTN.JK", "BBYB.JK", "BCAP.JK", "BDMN.JK", "BEST.JK", "BFIN.JK", "BINA.JK", "BIRD.JK", "BISI.JK", "BJBR.JK", "BJTM.JK", "BKSL.JK", "BMRI.JK", "BMTR.JK", "BNGA.JK", "BNII.JK", "BNLI.JK", "BRMS.JK", "BRPT.JK", "BSDE.JK", "BSIM.JK", "BTPN.JK", "BUDI.JK", "BUKK.JK", "BUMI.JK", "BVIC.JK", "BWPT.JK", "BYAN.JK", "CASS.JK", "CFIN.JK", "CMNP.JK", "CPIN.JK", "CTRA.JK", "DEWA.JK", "DILD.JK", "DLTA.JK", "DMAS.JK", "DOID.JK", "DSNG.JK", "DSSA.JK", "ELSA.JK", "EMTK.JK", "ENRG.JK", "ERAA.JK", "ESSA.JK", "EXCL.JK", "GEMS.JK", "GGRM.JK", "GJTL.JK", "HEXA.JK", "HMSP.JK", "HRUM.JK", "ICBP.JK", "IMAS.JK", "IMPC.JK", "INCO.JK", "INDF.JK", "INDY.JK", "INKP.JK", "INPC.JK", "INTP.JK", "ISAT.JK", "ISSP.JK", "ITMG.JK", "JKON.JK", "JPFA.JK", "JSMR.JK", "JTPE.JK", "KBLI.JK", "KIJA.JK", "KKGI.JK", "KLBF.JK", "LPKR.JK", "LPPF.JK", "LSIP.JK", "LTLS.JK", "MAIN.JK", "MAPI.JK", "MAYA.JK", "MBSS.JK", "MCOR.JK", "MDKA.JK", "MEDC.JK", "MEGA.JK", "MIDI.JK", "MIKA.JK", "MLBI.JK", "MLIA.JK", "MLPL.JK", "MMLP.JK", "MNCN.JK", "MPMX.JK", "MREI.JK", "MTDL.JK", "MTLA.JK", "MYOH.JK", "MYOR.JK", "NISP.JK", "PANR.JK", "PANS.JK", "PGAS.JK", "PNBN.JK", "PNIN.JK", "PNLF.JK", "PTBA.JK", "PTPP.JK", "PTRO.JK", "PWON.JK", "RAJA.JK", "RALS.JK", "SAME.JK", "SCMA.JK", "SGRO.JK", "SIDO.JK", "SILO.JK", "SIMP.JK", "SMBR.JK", "SMDR.JK", "SMGR.JK", "SMMA.JK", "SMRA.JK", "SMSM.JK", "SRTG.JK", "SSIA.JK", "SSMS.JK", "TBIG.JK", "TBLA.JK", "TINS.JK", "TKIM.JK", "TLKM.JK", "TMAS.JK", "TOBA.JK", "TOTL.JK", "TOWR.JK", "TPMA.JK", "TRIM.JK", "TSPC.JK", "ULTJ.JK", "UNIC.JK", "UNTR.JK", "UNVR.JK", "VICO.JK", "WIIM.JK", "WINS.JK", "WTON.JK", "SHIP.JK", "POWR.JK", "PRDA.JK", "BRIS.JK", "CARS.JK", "CLEO.JK", "WOOD.JK", "HRTA.JK", "MARK.JK", "MCAS.JK", "PSSI.JK", "MORA.JK", "PBID.JK", "BTPS.JK", "SPTO.JK", "HEAL.JK", "TUGU.JK", "MSIN.JK", "MAPA.JK", "IPCC.JK", "FILM.JK", "GOOD.JK", "SKRN.JK", "BOLA.JK", "KEEN.JK", "TEBE.JK", "PSGO.JK", "UCID.JK", "CSRA.JK", "SAMF.JK", "SGER.JK", "PNGO.JK", "BBSI.JK", "VICI.JK", "UNIQ.JK", "TAPG.JK", "BMHS.JK", "MCOL.JK", "MTEL.JK", "CMRY.JK", "RMKE.JK", "AVIA.JK", "DRMA.JK", "ADMR.JK", "STAA.JK", "MTMH.JK", "TRGU.JK", "HATM.JK", "JARR.JK", "ELPI.JK", "MKTR.JK", "OMED.JK", "PDPP.JK", "SUNI.JK", "PGEO.JK", "HILL.JK", "BDKR.JK", "CUAN.JK", "NCKL.JK", "MBMA.JK", "RAAM.JK", "SMIL.JK", "AMMN.JK", "MAHA.JK", "CNMA.JK", "ERAL.JK", "BREN.JK", "MSTI.JK", "ALII.JK", "GOLF.JK", "DAAZ.JK", "AADI.JK", "MDIY.JK", "DGWG.JK", "CBDK.JK", "MINE.JK", "PSAT.JK", "BLOG.JK", "YUPI.JK", "MDLA.JK"]'::jsonb) as value),
  (select array_agg(value::text) from jsonb_array_elements_text('["MMM", "AOS", "ABT", "ABBV", "ACN", "ADBE", "AMD", "AES", "AFL", "A", "APD", "ABNB", "AKAM", "ALB", "ARE", "ALGN", "ALLE", "LNT", "ALL", "GOOGL", "GOOG", "MO", "AMZN", "AMCR", "AEE", "AEP", "AXP", "AIG", "AMT", "AWK", "AMP", "AME", "AMGN", "APH", "ADI", "AON", "APA", "APO", "AAPL", "AMAT", "APTV", "ACGL", "ADM", "ANET", "AJG", "AIZ", "T", "ATO", "ADSK", "ADP", "AZO", "AVB", "AVY", "AXON", "BKR", "BALL", "BAC", "BAX", "BDX", "BRK.B", "BBY", "TECH", "BIIB", "BLK", "BX", "XYZ", "BK", "BA", "BKNG", "BSX", "BMY", "AVGO", "BR", "BRO", "BF.B", "BLDR", "BG", "BXP", "CHRW", "CDNS", "CZR", "CPT", "CPB", "COF", "CAH", "KMX", "CCL", "CARR", "CAT", "CBOE", "CBRE", "CDW", "COR", "CNC", "CNP", "CF", "CRL", "SCHW", "CHTR", "CVX", "CMG", "CB", "CHD", "CI", "CINF", "CTAS", "CSCO", "C", "CFG", "CLX", "CME", "CMS", "KO", "CTSH", "COIN", "CL", "CMCSA", "CAG", "COP", "ED", "STZ", "CEG", "COO", "CPRT", "GLW", "CPAY", "CTVA", "CSGP", "COST", "CTRA", "CRWD", "CCI", "CSX", "CMI", "CVS", "DHR", "DRI", "DDOG", "DVA", "DAY", "DECK", "DE", "DELL", "DAL", "DVN", "DXCM", "FANG", "DLR", "DG", "DLTR", "D", "DPZ", "DASH", "DOV", "DOW", "DHI", "DTE", "DUK", "DD", "EMN", "ETN", "EBAY", "ECL", "EIX", "EW", "EA", "ELV", "EMR", "ENPH", "ETR", "EOG", "EPAM", "EQT", "EFX", "EQIX", "EQR", "ERIE", "ESS", "EL", "EG", "EVRG", "ES", "EXC", "EXE", "EXPE", "EXPD", "EXR", "XOM", "FFIV", "FDS", "FICO", "FAST", "FRT", "FDX", "FIS", "FITB", "FSLR", "FE", "FI", "F", "FTNT", "FTV", "FOXA", "FOX", "BEN", "FCX", "GRMN", "IT", "GE", "GEHC", "GEV", "GEN", "GNRC", "GD", "GIS", "GM", "GPC", "GILD", "GPN", "GL", "GDDY", "GS", "HAL", "HIG", "HAS", "HCA", "DOC", "HSIC", "HSY", "HPE", "HLT", "HOLX", "HD", "HON", "HRL", "HST", "HWM", "HPQ", "HUBB", "HUM", "HBAN", "HII", "IBM", "IEX", "IDXX", "ITW", "INCY", "IR", "PODD", "INTC", "ICE", "IFF", "IP", "IPG", "INTU", "ISRG", "IVZ", "INVH", "IQV", "IRM", "JBHT", "JBL", "JKHY", "J", "JNJ", "JCI", "JPM", "K", "KVUE", "KDP", "KEY", "KEYS", "KMB", "KIM", "KMI", "KKR", "KLAC", "KHC", "KR", "LHX", "LH", "LRCX", "LW", "LVS", "LDOS", "LEN", "LII", "LLY", "LIN", "LYV", "LKQ", "LMT", "L", "LOW", "LULU", "LYB", "MTB", "MPC", "MKTX", "MAR", "MMC", "MLM", "MAS", "MA", "MTCH", "MKC", "MCD", "MCK", "MDT", "MRK", "META", "MET", "MTD", "MGM", "MCHP", "MU", "MSFT", "MAA", "MRNA", "MHK", "MOH", "TAP", "MDLZ", "MPWR", "MNST", "MCO", "MS", "MOS", "MSI", "MSCI", "NDAQ", "NTAP", "NFLX", "NEM", "NWSA", "NWS", "NEE", "NKE", "NI", "NDSN", "NSC", "NTRS", "NOC", "NCLH", "NRG", "NUE", "NVDA", "NVR", "NXPI", "ORLY", "OXY", "ODFL", "OMC", "ON", "OKE", "ORCL", "OTIS", "PCAR", "PKG", "PLTR", "PANW", "PSKY", "PH", "PAYX", "PAYC", "PYPL", "PNR", "PEP", "PFE", "PCG", "PM", "PSX", "PNW", "PNC", "POOL", "PPG", "PPL", "PFG", "PG", "PGR", "PLD", "PRU", "PEG", "PTC", "PSA", "PHM", "PWR", "QCOM", "DGX", "RL", "RJF", "RTX", "O", "REG", "REGN", "RF", "RSG", "RMD", "RVTY", "ROK", "ROL", "ROP", "ROST", "RCL", "SPGI", "CRM", "SBAC", "SLB", "STX", "SRE", "NOW", "SHW", "SPG", "SWKS", "SJM", "SW", "SNA", "SOLV", "SO", "LUV", "SWK", "SBUX", "STT", "STLD", "STE", "SYK", "SMCI", "SYF", "SNPS", "SYY", "TMUS", "TROW", "TTWO", "TPR", "TRGP", "TGT", "TEL", "TDY", "TER", "TSLA", "TXN", "TPL", "TXT", "TMO", "TJX", "TKO", "TTD", "TSCO", "TT", "TDG", "TRV", "TRMB", "TFC", "TYL", "TSN", "USB", "UBER", "UDR", "ULTA", "UNP", "UAL", "UPS", "URI", "UNH", "UHS", "VLO", "VTR", "VLTO", "VRSN", "VRSK", "VZ", "VRTX", "VTRS", "VICI", "V", "VST", "VMC", "WRB", "GWW", "WAB", "WBA", "WMT", "DIS", "WBD", "WM", "WAT", "WEC", "WFC", "WELL", "WST", "WDC", "WY", "WSM", "WMB", "WTW", "WDAY", "WYNN", "XEL", "XYL", "YUM", "ZBRA", "ZBH", "ZTS"]'::jsonb) as value),
  (select array_agg(value::text) from jsonb_array_elements_text('["BTC-USD", "ETH-USD", "USDT-USD", "XRP-USD", "BNB-USD", "SOL-USD", "USDC-USD", "STETH-USD", "TRX-USD", "DOGE-USD", "ADA-USD", "FIGR_HELOC-USD", "WSTETH-USD", "WBTC-USD", "WBETH-USD", "WBT-USD", "HYPE-USD", "ZEC-USD", "LINK-USD", "BCH-USD", "USDS-USD", "BSC-USD-USD", "USDE-USD", "XLM-USD", "WEETH-USD", "LEO-USD", "CBBTC-USD", "SUI-USD", "AVAX-USD", "HBAR-USD", "WETH-USD", "LTC-USD", "XMR-USD", "SHIB-USD", "TON-USD", "SUSDE-USD", "M-USD", "DAI-USD", "DOT-USD", "CRO-USD", "ICP-USD", "MNT-USD", "SUSDS-USD", "USDT0-USD", "TAO-USD", "UNI-USD", "WLFI-USD", "NEAR-USD", "USD1-USD", "AAVE-USD", "BUIDL-USD", "PYUSD-USD", "BGB-USD", "C1USD-USD", "ETC-USD", "OKB-USD", "PEPE-USD", "ENA-USD", "JITOSOL-USD", "USDF-USD", "XAUT-USD", "APT-USD", "ASTER-USD", "JLP-USD", "WETH-USD", "SOL-USD", "ONDO-USD", "AIA-USD", "USDTB-USD", "PI-USD", "POL-USD", "WLD-USD", "HTX-USD", "KCS-USD", "FIL-USD", "HASH-USD", "TRUMP-USD", "ARB-USD", "ALGO-USD", "RETH-USD", "BNSOL-USD", "KHYPE-USD", "GT-USD", "DASH-USD", "PAXG-USD", "BFUSD-USD", "KAS-USD", "ATOM-USD", "PUMP-USD", "VET-USD", "USDC-USD", "SYRUPUSDT-USD", "WBNB-USD", "OSETH-USD", "FBTC-USD", "LBTC-USD", "SYRUPUSDC-USD", "RSETH-USD", "QNT-USD", "IP-USD"]'::jsonb) as value)
)
on conflict (id) do update set
  idx_stocks = excluded.idx_stocks,
  us_stocks = excluded.us_stocks,
  crypto_stocks = excluded.crypto_stocks,
  updated_at = now();

-- MSCI Tracker Tables
-- Enum types for MSCI indices and status
do $$ begin
  create type msci_index_type as enum ('standard', 'small_cap');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type msci_status_type as enum ('included', 'watchlist', 'potential');
exception
  when duplicate_object then null;
end $$;

-- Main MSCI stocks table
create table if not exists public.msci_stocks (
  id uuid primary key default gen_random_uuid(),
  ticker text unique not null,
  company_name text not null,
  msci_index msci_index_type not null,
  msci_status msci_status_type not null,
  free_float_percent numeric(5, 2) not null check (free_float_percent >= 0 and free_float_percent <= 100),
  shares_outstanding bigint not null check (shares_outstanding > 0),
  "order" integer not null default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MSCI market data snapshot cache
create table if not exists public.msci_snapshot_cache (
  ticker text primary key,
  price numeric(15, 2),
  market_cap numeric(20, 2),
  free_float_mcap numeric(20, 2),
  last_updated_at timestamptz default now()
);

alter table public.msci_stocks enable row level security;
alter table public.msci_snapshot_cache enable row level security;

-- Public read access for MSCI data
create policy "Anyone can view MSCI stocks" on public.msci_stocks
  for select using (true);

create policy "Anyone can view MSCI cache" on public.msci_snapshot_cache
  for select using (true);

-- Service role can manage MSCI data
create policy "Service role maintains MSCI stocks" on public.msci_stocks
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "Service role maintains MSCI cache" on public.msci_snapshot_cache
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Indexes for performance
create index if not exists msci_stocks_ticker_idx on public.msci_stocks (ticker);
create index if not exists msci_stocks_index_status_idx on public.msci_stocks (msci_index, msci_status);
create index if not exists msci_stocks_order_idx on public.msci_stocks ("order");
create index if not exists msci_snapshot_cache_updated_idx on public.msci_snapshot_cache (last_updated_at desc);

-- Ajaib stock data table (real-time snapshot from Ajaib API)
create table if not exists public.ajaib_stocks (
  code text primary key,
  name text not null,
  price numeric(15, 2) not null,
  icon_url text,
  market_cap numeric(20, 2),
  volume bigint,
  price_1_week_price numeric(15, 2),
  price_1_week_pct_change numeric(8, 4),
  price_1_week_price_change numeric(15, 2),
  price_1_month_price numeric(15, 2),
  price_1_month_pct_change numeric(8, 4),
  price_1_month_price_change numeric(15, 2),
  updated_at timestamptz default now()
);

alter table public.ajaib_stocks enable row level security;

-- Public read access
create policy "Anyone can view Ajaib stocks" on public.ajaib_stocks
  for select using (true);

-- Service role can manage (upsert)
create policy "Service role maintains Ajaib stocks" on public.ajaib_stocks
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Index for performance
create index if not exists ajaib_stocks_updated_at_idx on public.ajaib_stocks (updated_at desc);

-- Discussion/Chat Messages Table
create table if not exists public.discussion_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) <= 1000),
  mentions text[] default '{}',
  reply_to_id uuid references public.discussion_messages (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.discussion_messages enable row level security;

-- Anyone can view messages
create policy "Anyone can view discussion messages" on public.discussion_messages
  for select using (true);

-- Authenticated users can insert their own messages
create policy "Users can insert their own messages" on public.discussion_messages
  for insert with check (auth.uid() = user_id);

-- Users can update their own messages
create policy "Users can update their own messages" on public.discussion_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Users can delete their own messages
create policy "Users can delete their own messages" on public.discussion_messages
  for delete using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists discussion_messages_created_at_idx on public.discussion_messages (created_at desc);
create index if not exists discussion_messages_user_id_idx on public.discussion_messages (user_id);
create index if not exists discussion_messages_reply_to_idx on public.discussion_messages (reply_to_id);
