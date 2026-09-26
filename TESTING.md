# Verification — 25 September 2026

- Production `next build`: passed, including TypeScript checks.
- ESLint: passed.
- Standings: 6 tests passed (wins/draws/away wins, tie-breakers, invalid and cross-season results, edit/delete recalculation, progression/total invariants, score validation).
- PostgreSQL/PGlite: schema and sample seed executed successfully; 20 role/RLS/constraint checks passed. Includes anonymous write denial, member self-promotion denial, forged authors, negative scores, self-matches, cross-season players, admin edits/deletes and atomic season activation.
- Chrome: tested desktop 1440px plus phone widths 360/390/430px; no document horizontal overflow and no browser errors.
- Browser flows: confirmation/cancel/save, match edit/delete, immediate count updates, player filter, player create/edit/delete, refusal to delete a player with history, season creation/activation, minimum player check, player detail modal, Escape dismissal and demo reload reset.

Not yet tested against a live Supabase project: email delivery/confirmation, account sign-in and hosted network configuration. No Supabase URL/public key or Vercel account was supplied. Local demo data is temporary; configure the real backend before inviting friends.
