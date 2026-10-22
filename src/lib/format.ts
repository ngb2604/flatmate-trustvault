export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function moneyWhole(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function pct(cents: number, total: number): string {
  if (!total) return "0%";
  return `${((cents / total) * 100).toFixed(1)}%`;
}

export function clockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function tokenExpiry(exp: number): string {
  return new Date(exp * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function splitProRata(
  amountCents: number,
  contributions: Record<string, number>,
  ids: string[],
): Record<string, number> {
  const total = ids.reduce((sum, id) => sum + (contributions[id] ?? 0), 0);
  if (total <= 0 || amountCents <= 0) {
    return Object.fromEntries(ids.map((id) => [id, 0]));
  }

  const shares: Record<string, number> = {};
  let allocated = 0;

  ids.forEach((id, index) => {
    if (index === ids.length - 1) {
      shares[id] = amountCents - allocated;
      return;
    }
    const share = Math.floor(
      (amountCents * (contributions[id] ?? 0)) / total,
    );
    shares[id] = share;
    allocated += share;
  });

  return shares;
}
