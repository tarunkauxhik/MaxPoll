-- Phase 16 · Chat surfaced at the top of a poll needs a count to show before
-- anyone opens the room. The poll page renders a chat entry with a message
-- count, and that page is the hottest in the product — denormalised + trigger,
-- exactly like vote_count, option_count and member_count. Never count(*) on the
-- render path.

alter table polls add column if not exists message_count int default 0;

create or replace function bump_message_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update polls set message_count = message_count + 1 where id = new.poll_id;
  elsif tg_op = 'DELETE' then
    update polls set message_count = greatest(0, message_count - 1) where id = old.poll_id;
  -- Hiding a message removes it from the room, so it must leave the count too.
  elsif new.hidden is distinct from old.hidden then
    update polls set message_count = (
      select count(*) from messages where poll_id = new.poll_id and hidden = false
    ) where id = new.poll_id;
  end if;
  return null;
end $$;

drop trigger if exists messages_count on messages;
create trigger messages_count
  after insert or delete or update of hidden on messages
  for each row execute function bump_message_count();

-- Backfill, once.
update polls p set message_count = (
  select count(*) from messages m where m.poll_id = p.id and m.hidden = false
);
