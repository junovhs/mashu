**Concrete change:** During directory scanning, show a live counter of files discovered so far and an estimated total (derived from the first N entries), so the user has a sense of progress rather than a static "Processing…" message.
**Main surface:** `src/ts/filesystem.ts` (scan loop), `src/ts/ui/layout.ts` or loader element
**Proof of done:** Dragging in a large folder shows an updating "X files found…" count that increments visibly during the scan.
**Out of scope:** Cancellation, pause/resume, worker-side progress, export progress (already handled).
