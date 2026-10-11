/** Funds with a book this month and last month. First disclosures are dropped from MoM stats. */
export function comparableFamilyIds(currentFamilyIds: number[], priorFamilyIds: number[]): {
  included: Set<number>;
  excludedNoPriorMonth: number;
} {
  const prior = new Set(priorFamilyIds);
  const included = new Set<number>();
  let excludedNoPriorMonth = 0;
  for (const id of new Set(currentFamilyIds)) {
    if (prior.has(id)) included.add(id);
    else excludedNoPriorMonth += 1;
  }
  return { included, excludedNoPriorMonth };
}

export function excludedNoPriorLabel(n: number): string | null {
  if (n <= 0) return null;
  return `Excludes ${n} fund${n === 1 ? "" : "s"} with no prior month.`;
}
