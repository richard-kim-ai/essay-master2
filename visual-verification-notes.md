# Visual verification notes

2026-08-14 desktop preview checks covered `/admin/curriculum`, `/admin/certificates`, and `/curriculum` at 1280×900. The administrator curriculum page displays four course groups, the high-university and general-adult sample groups show three cards each, and each card visibly includes the AI summary panel, reorder controls, and drag affordance. The certificate page displays the export preview card with filtered result, active, revoked, and course breakdown metrics plus date/course filters. The student curriculum page displays four course tabs and preserves the existing progress card layout.

The generated thumbnail URLs are wired into the sample records and UI; the captured preview still showed a light placeholder-like image area while generation was pending, which should be replaced by the reserved asset automatically. TypeScript and Vitest checks were run successfully before this screenshot pass.
