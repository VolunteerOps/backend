-- Run as bootstrap operator after migrations and creating sentinel_scanner.
GRANT USAGE ON SCHEMA public TO sentinel_scanner;
GRANT SELECT ON public.stored_objects TO sentinel_scanner;
GRANT UPDATE(state, scanned_at, scan_code) ON public.stored_objects TO sentinel_scanner;
GRANT SELECT, INSERT, UPDATE ON public.durable_jobs TO sentinel_scanner;
