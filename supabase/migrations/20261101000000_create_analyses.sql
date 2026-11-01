begin;

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  question text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists analyses_user_updated_idx
  on public.analyses (user_id, updated_at desc);

create table if not exists public.analysis_sources (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('url', 'text', 'pdf')),
  title text not null,
  url text,
  content text,
  position smallint not null default 0 check (position between 0 and 7),
  created_at timestamptz not null default now(),
  constraint source_url_required check (kind <> 'url' or url is not null)
);

create index if not exists analysis_sources_analysis_idx
  on public.analysis_sources (analysis_id, position);

alter table public.analyses enable row level security;
alter table public.analysis_sources enable row level security;

drop policy if exists "Users can read their own analyses" on public.analyses;
create policy "Users can read their own analyses"
  on public.analyses for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own analyses" on public.analyses;
create policy "Users can create their own analyses"
  on public.analyses for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own analyses" on public.analyses;
create policy "Users can update their own analyses"
  on public.analyses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own analyses" on public.analyses;
create policy "Users can delete their own analyses"
  on public.analyses for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own analysis sources" on public.analysis_sources;
create policy "Users can read their own analysis sources"
  on public.analysis_sources for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.analyses
      where analyses.id = analysis_sources.analysis_id
        and analyses.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can create their own analysis sources" on public.analysis_sources;
create policy "Users can create their own analysis sources"
  on public.analysis_sources for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.analyses
      where analyses.id = analysis_sources.analysis_id
        and analyses.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update their own analysis sources" on public.analysis_sources;
create policy "Users can update their own analysis sources"
  on public.analysis_sources for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.analyses
      where analyses.id = analysis_sources.analysis_id
        and analyses.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.analyses
      where analyses.id = analysis_sources.analysis_id
        and analyses.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can delete their own analysis sources" on public.analysis_sources;
create policy "Users can delete their own analysis sources"
  on public.analysis_sources for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.analyses
      where analyses.id = analysis_sources.analysis_id
        and analyses.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.analyses to authenticated;
grant select, insert, update, delete on public.analysis_sources to authenticated;

commit;
