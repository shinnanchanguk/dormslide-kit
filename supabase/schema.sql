-- 도름슬라이드 실시간 모드 (선생님 본인의 수파베이스에 한 번 실행)
--
-- 준비 두 가지
--   1) 수파베이스 대시보드 → Authentication → Sign In / Providers → "Allow anonymous sign-ins" 를 켠다.
--      학생은 이메일 없이 브라우저마다 익명 번호를 하나 받는다. 아래 규칙은 그 번호로 '한 사람 한 표'를 지킨다.
--   2) SQL Editor 에 이 파일 전체를 붙여 넣고 Run. 다시 실행해도 안전하다.
--
-- 지키는 것
--   · 모든 쓰기는 로그인(익명 포함)한 사람만, 자기 번호로만 한다. 남의 표·글을 고치거나 지울 수 없다.
--   · 객관식은 한 사람 한 표(바꾸면 고쳐진다). 서술형·게시물은 한 사람이 한 장에 올릴 수 있는 개수에 상한이 있다.
--   · 발표자(장 넘기기·칸 옮기기·방 비우기)는 그 방을 처음 연 브라우저의 번호뿐이다.
--   · 방 이름은 화면이 무작위로 만든다(예: ds-k3x9-2m7q). 이름을 아는 사람만 들어온다.
--   · 학생 이름 대신 별명만 받는다. 수업이 끝나면 ds_clear_room 으로 그 방을 비운다.

create extension if not exists pgcrypto;

create table if not exists public.ds_responses (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room ~ '^[a-z0-9-]{6,60}$'),
  slide int not null check (slide between 0 and 500),
  kind text not null check (kind in ('choice', 'text')),
  option int check (option between 0 and 20),
  text text check (char_length(text) <= 400),
  voter uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((kind = 'choice' and option is not null and text is null) or (kind = 'text' and text is not null and option is null))
);
create unique index if not exists ds_responses_one_vote on public.ds_responses (room, slide, voter) where kind = 'choice';

create table if not exists public.ds_board (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room ~ '^[a-z0-9-]{6,60}$'),
  slide int not null check (slide between 0 and 500),
  author uuid not null default auth.uid(),
  nickname text not null check (char_length(nickname) between 1 and 20),
  text text not null check (char_length(text) between 1 and 400),
  url text check (url is null or (char_length(url) <= 500 and url ~ '^https://')),
  bucket text check (bucket is null or char_length(bucket) <= 40),
  likes int not null default 0 check (likes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ds_likes (
  item_id uuid not null references public.ds_board(id) on delete cascade,
  voter uuid not null,
  primary key (item_id, voter)
);

create table if not exists public.ds_presenter (
  room text primary key check (room ~ '^[a-z0-9-]{6,60}$'),
  slide_index int not null default 0 check (slide_index between 0 and 500),
  owner uuid not null,
  updated_at timestamptz not null default now()
);

create index if not exists ds_responses_room_slide on public.ds_responses (room, slide);
create index if not exists ds_board_room_slide on public.ds_board (room, slide);

alter table public.ds_responses enable row level security;
alter table public.ds_board enable row level security;
alter table public.ds_likes enable row level security;
alter table public.ds_presenter enable row level security;

-- 읽기: 방 안의 응답·게시물·발표자 위치는 들어온 사람이 읽는다(이름 없이 별명·익명).
drop policy if exists ds_responses_read on public.ds_responses;
create policy ds_responses_read on public.ds_responses for select to authenticated using (true);
drop policy if exists ds_board_read on public.ds_board;
create policy ds_board_read on public.ds_board for select to authenticated using (true);
drop policy if exists ds_presenter_read on public.ds_presenter;
create policy ds_presenter_read on public.ds_presenter for select to authenticated using (true);

-- 쓰기: 서술형 답과 게시물은 자기 번호로만 넣는다. 객관식은 ds_vote 함수로만(한 사람 한 표).
drop policy if exists ds_responses_insert on public.ds_responses;
create policy ds_responses_insert on public.ds_responses for insert to authenticated
  with check (voter = auth.uid() and kind = 'text');
drop policy if exists ds_responses_update on public.ds_responses;
drop policy if exists ds_board_insert on public.ds_board;
create policy ds_board_insert on public.ds_board for insert to authenticated
  with check (author = auth.uid() and likes = 0 and bucket is null);

revoke all on public.ds_responses, public.ds_board, public.ds_likes, public.ds_presenter from anon;
revoke update, delete on public.ds_responses, public.ds_board from authenticated;
revoke insert, update, delete on public.ds_presenter, public.ds_likes from authenticated;

-- 한 사람이 한 장에 너무 많이 올리지 못하게(장난 방지), 방 하나가 너무 커지지 않게 막는다.
create or replace function public.ds_limit_board() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.ds_board where room = new.room and slide = new.slide and author = new.author) >= 10 then
    raise exception 'too many posts from one person';
  end if;
  if (select count(*) from public.ds_board where room = new.room and slide = new.slide) >= 300 then
    raise exception 'too many items';
  end if;
  return new;
end $$;
drop trigger if exists ds_board_limit on public.ds_board;
create trigger ds_board_limit before insert on public.ds_board for each row execute function public.ds_limit_board();

create or replace function public.ds_limit_text() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'text' and (select count(*) from public.ds_responses where room = new.room and slide = new.slide and voter = new.voter and kind = 'text') >= 5 then
    raise exception 'too many answers from one person';
  end if;
  return new;
end $$;
drop trigger if exists ds_responses_limit on public.ds_responses;
create trigger ds_responses_limit before insert on public.ds_responses for each row execute function public.ds_limit_text();

create or replace function public.ds_vote(p_room text, p_slide int, p_option int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.ds_responses (room, slide, kind, option, voter) values (p_room, p_slide, 'choice', p_option, auth.uid())
  on conflict (room, slide, voter) where kind = 'choice' do update set option = excluded.option, created_at = now();
end $$;

create or replace function public.ds_like(p_room text, p_slide int, p_item uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.ds_likes (item_id, voter) values (p_item, auth.uid()) on conflict do nothing;
  if found then
    update public.ds_board set likes = likes + 1 where id = p_item and room = p_room and slide = p_slide;
  end if;
end $$;

-- 발표자 위치. 방을 처음 여는 사람(익명 번호)이 그 방의 발표자가 된다. 그 뒤에는 그 사람만 바꾼다.
create or replace function public.ds_set_presenter(p_room text, p_index int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.ds_presenter (room, slide_index, owner) values (p_room, p_index, auth.uid())
  on conflict (room) do update set slide_index = excluded.slide_index, updated_at = now()
    where public.ds_presenter.owner = auth.uid();
end $$;

create or replace function public.ds_is_presenter(p_room text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ds_presenter where room = p_room and owner = auth.uid());
$$;

create or replace function public.ds_move_bucket(p_room text, p_slide int, p_item uuid, p_bucket text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ds_is_presenter(p_room) then raise exception 'not presenter'; end if;
  update public.ds_board set bucket = left(p_bucket, 40) where id = p_item and room = p_room and slide = p_slide;
end $$;

-- 수업이 끝나면 발표자가 방을 비운다(학생 응답·게시물·발표자 기록을 지운다).
create or replace function public.ds_clear_room(p_room text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ds_is_presenter(p_room) then raise exception 'not presenter'; end if;
  delete from public.ds_responses where room = p_room;
  delete from public.ds_board where room = p_room;
  delete from public.ds_presenter where room = p_room;
end $$;

revoke all on function public.ds_vote(text, int, int), public.ds_like(text, int, uuid), public.ds_set_presenter(text, int),
  public.ds_is_presenter(text), public.ds_move_bucket(text, int, uuid, text), public.ds_clear_room(text),
  public.ds_limit_board(), public.ds_limit_text() from public, anon;
grant execute on function public.ds_vote(text, int, int), public.ds_like(text, int, uuid), public.ds_set_presenter(text, int),
  public.ds_is_presenter(text), public.ds_move_bucket(text, int, uuid, text), public.ds_clear_room(text) to authenticated;

-- 실시간 알림을 켠다.
do $$ begin
  begin alter publication supabase_realtime add table public.ds_responses; exception when others then null; end;
  begin alter publication supabase_realtime add table public.ds_board; exception when others then null; end;
  begin alter publication supabase_realtime add table public.ds_presenter; exception when others then null; end;
end $$;
