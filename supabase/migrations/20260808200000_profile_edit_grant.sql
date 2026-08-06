-- 20260806110000_column_guards.sql revoked update on profiles entirely and
-- dropped profiles_update, deliberately, since no edit screen existed yet.
-- Phase 17 adds one — re-open exactly 5 columns, the D2b/D2e pattern: RLS
-- picks rows, GRANT picks columns.
--
-- NOT granted: handle, id, dob, created_at. Handle changes break every
-- existing /@handle link and share; dob is the 18+ record, not a preference;
-- id/created_at are never user-editable.
grant update (display_name, bio, instagram, x_handle, snapchat) on profiles to authenticated;

create policy profiles_update_own on profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
