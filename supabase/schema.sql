-- 도름슬라이드 실시간 모드 (선생님 본인의 수파베이스에 한 번 실행)
--
-- 수파베이스 대시보드 → SQL Editor 에 이 파일 전체를 붙여 넣고 Run. 다시 실행해도 안전하다.
-- 학생은 로그인하지 않는다. 그래서 아래 규칙(RLS)이 '아무나 쓸 수 있는 곳'에서 할 수 있는 일을 좁게 막는다.
--   · 응답·게시물은 누구나 넣고 읽을 수 있지만 길이·개수에 상한이 있다.
--   · 발표자 쪽(장 넘기기·칸 옮기기·방 비우기)은 그 방을 처음 연 발표자 열쇠가 있어야 한다.
--   · 학생 이름 대신 별명만 받는다. 수업이 끝나면 ds_clear_room 으로 그 방을 비운다.

create extension if not exists pgcrypto;

create table if not exists public.ds_responses (
  id uuid primary key default gen_random_uuid(),
  room text not null check (char_length(room) between 1 and 60),
  slide int not null check (slide between 0 and 500),
  option int check (option between 0 and 20),
  text text check (char_length(text) <= 400),
  voter text not null check (char_length(voter) between 8 and 48),
  created_at timestamptz not null default now(),
  unique (room, slide, voter)
);

create table if not exists public.ds_board (
  id uuid primary key default gen_random_uuid(),
  room text not null check (char_length(room) between 1 and 60),
  slide int not null check (slide between 0 and 500),
  nickname text not null check (char_length(nickname) between 1 and 20),
  text text not null check (char_length(text) between 1 and 400),
  url text check (url is null or (char_length(url) <= 500 and url ~ '^https://')),
  bucket text check (bucket is null or char_length(bucket) <= 40),
  likes int not null default 0 check (likes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ds_likes (
  item_id uuid not null references public.ds_board(id) on delete cascade,
  voter text not null check (char_length(voter) between 8 and 48),
  primary key (item_id, voter)
);

create table if not exists public.ds_presenter (
  room text primary key check (char_length(room) between 1 and 60),
  slide_index int not null default 0 check (slide_index between 0 and 500),
  key_hash text not null,
  updated_at timestamptz not null default now()
);

create index if not exists ds_responses_room_slide on public.ds_responses (room, slide);
create index if not exists ds_board_room_slide on public.ds_board (room, slide);

alter table public.ds_responses enable row level security;
alter table public.ds_board enable row level security;
alter table public.ds_likes enable row level security;
alter table public.ds_presenter enable row level security;

-- 읽기: 방 안의 응답·게시물·발표자 위치는 누구나 읽는다(이름 없이 별명·익명).
drop policy if exists ds_responses_read on public.ds_responses;
create policy ds_responses_read on public.ds_responses for select to anon, authenticated using (true);
drop policy if exists ds_board_read on public.ds_board;
create policy ds_board_read on public.ds_board for select to anon, authenticated using (true);
drop policy if exists ds_presenter_read on public.ds_presenter;
create policy ds_presenter_read on public.ds_presenter for select to anon, authenticated using (true);

-- 쓰기: 응답은 넣기만. 고르는 답을 바꾸는 일은 ds_vote 함수가 그 사람의 줄만 고친다. 지우기 정책은 두지 않는다.
drop policy if exists ds_responses_insert on public.ds_responses;
create policy ds_responses_insert on public.ds_responses for insert to anon, authenticated with check (true);
drop policy if exists ds_responses_update on public.ds_responses;
drop policy if exists ds_board_insert on public.ds_board;
create policy ds_board_insert on public.ds_board for insert to anon, authenticated with check (likes = 0 and bucket is null);

-- 표를 직접 고치는 권한은 거둔다. 좋아요·칸 옮기기·발표자는 아래 함수로만 한다.
revoke update, delete on public.ds_board from anon, authenticated;
revoke update, delete on public.ds_responses from anon, authenticated;
revoke insert, update, delete on public.ds_presenter from anon, authenticated;
revoke all on public.ds_likes from anon, authenticated;

-- 한 방에 너무 많이 쌓이지 않게 막는다(장난 방지).
create or replace function public.ds_limit_rows() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.ds_board where room = new.room and slide = new.slide) >= 300 then
    raise exception 'too many items';
  end if;
  return new;
end $$;
drop trigger if exists ds_board_limit on public.ds_board;
create trigger ds_board_limit before insert on public.ds_board for each row execute function public.ds_limit_rows();

create or replace function public.ds_key_ok(p_room text, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ds_presenter where room = p_room and key_hash = encode(digest(p_key, 'sha256'), 'hex'));
$$;

-- 발표자 위치. 방을 처음 여는 사람의 열쇠가 그 방의 발표자 열쇠가 된다.
create or replace function public.ds_set_presenter(p_room text, p_index int, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(p_key, '')) < 16 then raise exception 'key too short'; end if;
  insert into public.ds_presenter (room, slide_index, key_hash)
  values (p_room, p_index, encode(digest(p_key, 'sha256'), 'hex'))
  on conflict (room) do update
    set slide_index = excluded.slide_index, updated_at = now()
    where public.ds_presenter.key_hash = excluded.key_hash;
end $$;

create or replace function public.ds_vote(p_room text, p_slide int, p_option int, p_voter text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.ds_responses (room, slide, option, voter) values (p_room, p_slide, p_option, p_voter)
  on conflict (room, slide, voter) do update set option = excluded.option, created_at = now();
end $$;

create or replace function public.ds_like(p_room text, p_slide int, p_item uuid, p_voter text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.ds_likes (item_id, voter) values (p_item, p_voter) on conflict do nothing;
  if found then
    update public.ds_board set likes = likes + 1 where id = p_item and room = p_room and slide = p_slide;
  end if;
end $$;

create or replace function public.ds_move_bucket(p_room text, p_slide int, p_item uuid, p_bucket text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ds_key_ok(p_room, p_key) then raise exception 'not presenter'; end if;
  update public.ds_board set bucket = left(p_bucket, 40) where id = p_item and room = p_room and slide = p_slide;
end $$;

-- 수업이 끝나면 발표자가 방을 비운다(학생 응답·게시물을 지운다).
create or replace function public.ds_clear_room(p_room text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.ds_key_ok(p_room, p_key) then raise exception 'not presenter'; end if;
  delete from public.ds_responses where room = p_room;
  delete from public.ds_board where room = p_room;
end $$;

revoke all on function public.ds_key_ok(text, text) from public, anon, authenticated;
grant execute on function public.ds_set_presenter(text, int, text) to anon, authenticated;
grant execute on function public.ds_vote(text, int, int, text) to anon, authenticated;
grant execute on function public.ds_like(text, int, uuid, text) to anon, authenticated;
grant execute on function public.ds_move_bucket(text, int, uuid, text, text) to anon, authenticated;
grant execute on function public.ds_clear_room(text, text) to anon, authenticated;

-- 실시간 알림을 켠다.
do $$ begin
  begin alter publication supabase_realtime add table public.ds_responses; exception when others then null; end;
  begin alter publication supabase_realtime add table public.ds_board; exception when others then null; end;
  begin alter publication supabase_realtime add table public.ds_presenter; exception when others then null; end;
end $$;
