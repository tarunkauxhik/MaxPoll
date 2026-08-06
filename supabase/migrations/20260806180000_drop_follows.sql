-- Follows removed from the product.
--
-- The graph fed exactly one thing — a `new_follower` notification — and a
-- follower count that reads 0 on almost every profile is a status symbol nobody
-- earned. 01-product's growth thesis is link travel between WhatsApp groups, not
-- an in-app social graph, and nothing in the funnel depended on this.
--
-- ⚠️ ORDERING. This runs **after** the deploy that removed every reader, not
-- before. Revoking on a live database ahead of its code is what took chat down
-- for two minutes in Phase 10 (LEARNINGS). Dropping a table the running code
-- still selects from would be the same mistake with a longer outage.

-- The trigger goes first: it is `security definer` and writes activity rows, so
-- leaving it behind a dropped table would be a broken write path, not a no-op.
drop trigger if exists follow_activity on follows;
drop function if exists trg_follow_activity();

drop table if exists follows;

-- Rows already in someone's feed. The activity page falls back gracefully for an
-- unknown type, but a notification about a feature that no longer exists is
-- clutter at best and confusing at worst.
delete from activity where type = 'new_follower';
