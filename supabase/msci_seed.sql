-- MSCI Seed Data for Testing
-- Sample Indonesian stocks with MSCI potential

-- Insert sample stocks for MSCI Global Standard
insert into public.msci_stocks (ticker, company_name, msci_index, msci_status, free_float_percent, shares_outstanding, "order", notes)
values
  ('BBCA.JK', 'Bank Central Asia Tbk', 'standard', 'included', 45.50, 122650048640, 1, 'Largest private bank in Indonesia'),
  ('BBRI.JK', 'Bank Rakyat Indonesia Tbk', 'standard', 'included', 43.25, 124870858765, 2, 'State-owned commercial bank'),
  ('BMRI.JK', 'Bank Mandiri Tbk', 'standard', 'included', 40.10, 119444320525, 3, 'State-owned bank'),
  ('TLKM.JK', 'Telkom Indonesia Tbk', 'standard', 'included', 47.92, 99999999000, 4, 'State-owned telecom'),
  ('ASII.JK', 'Astra International Tbk', 'standard', 'included', 49.50, 40483553140, 5, 'Diversified conglomerate'),
  ('UNVR.JK', 'Unilever Indonesia Tbk', 'standard', 'watchlist', 15.00, 7630000000, 6, 'Consumer goods'),
  ('ICBP.JK', 'Indofood CBP Sukses Makmur', 'standard', 'watchlist', 19.50, 8793220500, 7, 'Food and beverages'),
  ('HMSP.JK', 'HM Sampoerna Tbk', 'standard', 'potential', 10.00, 3770000000, 8, 'Tobacco manufacturer'),
  ('KLBF.JK', 'Kalbe Farma Tbk', 'standard', 'potential', 35.75, 46875733755, 9, 'Pharmaceutical'),
  ('GGRM.JK', 'Gudang Garam Tbk', 'standard', 'potential', 12.50, 1924088000, 10, 'Tobacco manufacturer')
on conflict (ticker) do update set
  company_name = excluded.company_name,
  msci_index = excluded.msci_index,
  msci_status = excluded.msci_status,
  free_float_percent = excluded.free_float_percent,
  shares_outstanding = excluded.shares_outstanding,
  "order" = excluded."order",
  notes = excluded.notes,
  updated_at = now();

-- Insert sample stocks for MSCI Global Small Cap
insert into public.msci_stocks (ticker, company_name, msci_index, msci_status, free_float_percent, shares_outstanding, "order", notes)
values
  ('ACES.JK', 'Ace Hardware Indonesia Tbk', 'small_cap', 'included', 28.50, 8400000000, 1, 'Home improvement retail'),
  ('MAPI.JK', 'Mitra Adiperkasa Tbk', 'small_cap', 'watchlist', 32.10, 23962500000, 2, 'Lifestyle retail'),
  ('SCMA.JK', 'Surya Citra Media Tbk', 'small_cap', 'watchlist', 26.75, 23856000000, 3, 'Media and entertainment'),
  ('JPFA.JK', 'Japfa Comfeed Indonesia', 'small_cap', 'potential', 22.40, 7410000000, 4, 'Poultry and feed'),
  ('WOOD.JK', 'Integra Indocabinet Tbk', 'small_cap', 'potential', 18.90, 2000000000, 5, 'Furniture manufacturer'),
  ('INTP.JK', 'Indocement Tunggal Prakarsa', 'small_cap', 'watchlist', 35.00, 11111111000, 6, 'Cement producer'),
  ('SMGR.JK', 'Semen Indonesia Tbk', 'small_cap', 'watchlist', 41.25, 11968000000, 7, 'Cement producer'),
  ('ADRO.JK', 'Adaro Energy Indonesia', 'small_cap', 'potential', 37.50, 38888888888, 8, 'Coal mining'),
  ('PTBA.JK', 'Bukit Asam Tbk', 'small_cap', 'potential', 34.60, 2304131850, 9, 'Coal mining'),
  ('ANTM.JK', 'Aneka Tambang Tbk', 'small_cap', 'potential', 35.00, 9538459625, 10, 'Mining')
on conflict (ticker) do update set
  company_name = excluded.company_name,
  msci_index = excluded.msci_index,
  msci_status = excluded.msci_status,
  free_float_percent = excluded.free_float_percent,
  shares_outstanding = excluded.shares_outstanding,
  "order" = excluded."order",
  notes = excluded.notes,
  updated_at = now();
