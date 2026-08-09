# Docs

Three files. That is the whole set.

| File | What's in it |
|---|---|
| [RULES.md](RULES.md) | The things that cost money, leak data, or break silently. Plus how to work here. |
| [DESIGN.md](DESIGN.md) | The tokens, the type scale, the breakpoints, the quality floor. `app/globals.css` is the source of truth; this explains it. |
| [RUNBOOK.md](RUNBOOK.md) | Run · migrate · deploy · the external services. |

There used to be eleven files here, including a 47KB status log and a 36KB
decision history that had to be read before touching anything. They are all in
git history. What survived is the part that is still *true and load-bearing* —
a rule you can break expensively, not a record of how we got here.

**Don't grow this back.** A new document needs to answer a question the code
cannot. Anything explaining *why this code is like this* belongs in a comment
next to the code, where it cannot rot separately.
