-- 1. Add 'timeframe' column
ALTER TABLE public.money_flow_reports ADD COLUMN IF NOT EXISTS timeframe text NOT NULL DEFAULT 'weekly';
ALTER TABLE public.money_flow_reports ADD COLUMN IF NOT EXISTS price_change_3m numeric(12, 6) NOT NULL DEFAULT 0;

-- 2. Drop the old unique constraint (assuming it was the Primary Key or a UNIQUE constraint named something like money_flow_reports_pkey or money_flow_reports_symbol_report_date_key)
-- NOTE: Please check your exact constraint name in Supabase for (symbol, report_date) and adjust if necessary.
ALTER TABLE public.money_flow_reports DROP CONSTRAINT IF EXISTS money_flow_reports_symbol_report_date_key;
ALTER TABLE public.money_flow_reports DROP CONSTRAINT IF EXISTS money_flow_reports_pkey;

-- 3. Add the new composite Primary Key or Unique Constraint
ALTER TABLE public.money_flow_reports ADD PRIMARY KEY (symbol, report_date, timeframe);
