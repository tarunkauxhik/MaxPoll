-- Two unrelated things that both hinge on the same rule: a guard written in
-- TypeScript is an error message, not a control (docs/RULES.md).

-- ============================================================ dob

-- `dob` is commented "NEVER exposed publicly" and every select in the app was
-- written to skip it — but `profiles_read` is `using (true)` and `select` was
-- granted on the whole table, so anyone holding the publishable key (which is in
-- every browser) could read any user's date of birth. The privacy policy says it
-- is "never shown to anyone"; that promise lived in a convention.
--
-- RLS picks rows, so a column needs its own grant. Every column the app actually
-- reads is re-granted by name; `dob` is not one of them.
revoke select on profiles from anon, authenticated;
grant select (id, handle, display_name, bio, instagram, x_handle, snapchat, created_at)
  on profiles to anon, authenticated;

-- The edit screen shows you your own date of birth (read-only — it is the 18+
-- record, not a preference). A grant cannot say "this column, but only your own
-- row", so the one legitimate read gets a function. No argument: identity comes
-- from auth.uid(), never from the caller.
create or replace function my_dob()
returns date
language sql
security definer
set search_path = public, pg_temp
as $$ select dob from profiles where id = auth.uid() $$;

revoke execute on function my_dob() from public, anon;
grant  execute on function my_dob() to authenticated;

-- ============================================================ razorpay

-- The Razorpay rail. `orders` stays the ledger and `entitlements` stays the
-- grant; this only adds the two ids that let a callback or a webhook find the
-- order it is talking about.
alter table orders add column if not exists razorpay_order_id   text;
alter table orders add column if not exists razorpay_payment_id text;

-- The webhook's only lookup key, and the thing that stops two orders claiming
-- one payment.
create unique index if not exists orders_rzp_order_uniq
  on orders (razorpay_order_id) where razorpay_order_id is not null;

-- Deliberately NOT granted to authenticated: `update on orders` is revoked and
-- re-granted column by column (initial schema), and these two are written by the
-- server with the secret key after it has checked who owns the row. A client
-- that could write razorpay_order_id could point its own order at somebody
-- else's payment.

-- The Razorpay twin of verify_order(): flip the order and grant access in ONE
-- transaction, because half of this happening is somebody paying and not getting
-- in. Reached from the checkout callback and from the webhook, so it must be
-- idempotent — both fire for the same payment on a normal successful checkout.
--
-- security definer with a pinned search_path; execute revoked from every client
-- role. Only service_role reaches it, and only after the caller has verified
-- Razorpay's HMAC signature. There is deliberately no client path.
create or replace function verify_razorpay_order(p_rzp_order text, p_payment_id text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare o orders;
begin
  select * into o from orders where razorpay_order_id = p_rzp_order for update;
  if not found then raise exception 'NO_ORDER'; end if;

  -- Already granted. Return the ref so a duplicate callback still redirects the
  -- payer somewhere useful instead of erroring at them after they have paid.
  if o.status = 'verified' then return o.ref; end if;

  insert into entitlements (user_id, poll_id, kind, source, payment_ref, expires_at)
  values (
    o.user_id,
    o.poll_id,
    case o.kind when 'pass_30d' then 'sub_monthly' else 'poll_unlock' end,
    'razorpay',
    p_payment_id,
    -- The ₹99 tier is a 30-day pass, not a subscription: no mandate, no
    -- auto-renew. Same as the manual rail.
    case o.kind when 'pass_30d' then now() + interval '30 days' end
  )
  -- entitlements_payment_uniq (source, payment_ref) is the idempotency key.
  on conflict do nothing;

  update orders
     set status = 'verified', decided_at = now(), razorpay_payment_id = p_payment_id
   where id = o.id;

  return o.ref;
end $$;

revoke execute on function verify_razorpay_order(text, text) from public, anon, authenticated;
