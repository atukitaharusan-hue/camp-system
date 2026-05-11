-- ============================================================
-- Restrict anon write access for admin-managed tables
-- ============================================================

-- Master data writes must go through authenticated admin Route Handlers.
drop policy if exists "Allow anon insert sites" on public.sites;
drop policy if exists "Allow anon update sites" on public.sites;
drop policy if exists "Allow anon delete sites" on public.sites;
drop policy if exists "Allow anon insert options" on public.options;
drop policy if exists "Allow anon update options" on public.options;
drop policy if exists "Allow anon delete options" on public.options;
drop policy if exists "Allow anon insert plans" on public.plans;
drop policy if exists "Allow anon update plans" on public.plans;
drop policy if exists "Allow anon delete plans" on public.plans;
drop policy if exists "Allow anon insert plan_sites" on public.plan_sites;
drop policy if exists "Allow anon delete plan_sites" on public.plan_sites;
drop policy if exists "Allow anon insert plan_options" on public.plan_options;
drop policy if exists "Allow anon delete plan_options" on public.plan_options;
drop policy if exists "Allow anon insert events" on public.events;
drop policy if exists "Allow anon update events" on public.events;
drop policy if exists "Allow anon delete events" on public.events;

-- app_settings writes must go through authenticated Route Handlers.
drop policy if exists "Allow anon select app_settings" on public.app_settings;
drop policy if exists "Allow anon insert app_settings" on public.app_settings;
drop policy if exists "Allow anon update app_settings" on public.app_settings;

create policy "Allow anon select public app_settings"
	on public.app_settings
	for select
	using (
		key in (
			'calendar_display_settings',
			'policy_settings',
			'pricing_settings',
			'qr_screen_settings',
			'site_map_settings'
		)
	);

-- Sales rule writes must go through authenticated admin Route Handlers.
drop policy if exists "Allow anon insert closed_dates" on public.closed_dates;
drop policy if exists "Allow anon delete closed_dates" on public.closed_dates;
drop policy if exists "Allow anon insert closed_date_ranges" on public.closed_date_ranges;
drop policy if exists "Allow anon update closed_date_ranges" on public.closed_date_ranges;
drop policy if exists "Allow anon delete closed_date_ranges" on public.closed_date_ranges;
drop policy if exists "Allow anon insert site_closures" on public.site_closures;
drop policy if exists "Allow anon update site_closures" on public.site_closures;
drop policy if exists "Allow anon delete site_closures" on public.site_closures;

-- Import job writes must go through /api/import-reservations.
drop policy if exists "import_jobs_anon_select" on public.import_jobs;
drop policy if exists "import_jobs_anon_insert" on public.import_jobs;
drop policy if exists "import_jobs_anon_update" on public.import_jobs;
drop policy if exists "import_job_rows_anon_select" on public.import_job_rows;
drop policy if exists "import_job_rows_anon_insert" on public.import_job_rows;

-- Admin member/invite writes are not public operations.
drop policy if exists "Allow anon select admin_members" on public.admin_members;
drop policy if exists "Allow anon insert admin_members" on public.admin_members;
drop policy if exists "Allow anon update admin_members" on public.admin_members;
drop policy if exists "Allow anon delete admin_members" on public.admin_members;
drop policy if exists "Allow anon select admin_invites" on public.admin_invites;
drop policy if exists "Allow anon insert admin_invites" on public.admin_invites;
drop policy if exists "Allow anon update admin_invites" on public.admin_invites;
drop policy if exists "Allow anon delete admin_invites" on public.admin_invites;

-- Logs are admin-only and must go through authenticated admin Route Handlers.
drop policy if exists "notification_logs_anon_all" on public.notification_logs;
drop policy if exists "admin_action_logs_anon_all" on public.admin_action_logs;
drop policy if exists "notification_logs_anon_select" on public.notification_logs;
drop policy if exists "admin_action_logs_anon_select" on public.admin_action_logs;

-- Public booking still creates guest reservations, but updates must use server APIs.
drop policy if exists "Allow anonymous update" on public.guest_reservations;