const CELLS = 13;

// Deterministic decorative pattern (not a real code — real QR ships with
// the deploy URL). Finder squares in three corners, pseudo-pattern fill.
function pattern(row: number, col: number): boolean {
  const inFinder =
    (row < 4 && col < 4) || (row < 4 && col > 8) || (row > 8 && col < 4);
  if (inFinder) {
    if (col > 8) {
      const r = row;
      const c = col - 9;
      return r === 0 || r === 3 || c === 0 || c === 3;
    }
    const r = row > 8 ? row - 9 : row;
    const c = col;
    return r === 0 || r === 3 || c === 0 || c === 3;
  }
  return (row * 7 + col * 11 + ((row * col) % 5)) % 3 === 0;
}

export default function QrDownloadCard() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-espresso bg-warm-bone text-espresso">
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="flex items-center justify-center bg-pure-white p-6">
          <div
            role="img"
            aria-label="Demo QR placeholder — real code ships with the deploy URL"
            className="grid w-full max-w-[220px] gap-0 border border-espresso p-2"
            style={{ gridTemplateColumns: `repeat(${CELLS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: CELLS * CELLS }).map((_, i) => {
              const row = Math.floor(i / CELLS);
              const col = i % CELLS;
              return (
                <span
                  key={i}
                  className={pattern(row, col) ? "bg-espresso" : "bg-pure-white"}
                  style={{ aspectRatio: "1" }}
                />
              );
            })}
          </div>
        </div>
        <div className="flex flex-col items-start justify-center gap-4 p-6 sm:p-8">
          <span className="rounded-[20px] bg-ember-wash px-3 py-1 text-[12px] font-medium text-bark">
            Solana Devnet
          </span>
          <p className="text-[24px] leading-[1.33] font-semibold tracking-[-0.015em]">
            Same wallet, bigger screen.
          </p>
          <p className="max-w-[48ch] text-[16px] leading-[1.5]">
            Amana lives in your chat. Scan to open the web app, or keep going
            in WhatsApp — the balance follows you either way.
          </p>
          <p className="font-instrument-serif text-[16px] text-taupe italic">
            one wallet, two doors
          </p>
        </div>
      </div>
    </div>
  );
}
