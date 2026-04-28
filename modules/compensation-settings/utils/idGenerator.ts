/**
 * Generates the next numeric ID in a binary-looking sequence.
 * Pattern: 1, 10, 11, 100, 101, 110, 111, 1000...
 * 
 * Logic:
 * 1. Interpret existing numeric IDs as binary strings.
 * 2. Convert to decimal indices.
 * 3. Find max index, increment it.
 * 4. Convert new index back to binary string, then to number.
 */
export function generateNextBinaryId(existingIds: number[]): number {
  if (!existingIds || existingIds.length === 0) return 1;

  const indices = existingIds.map(id => {
    try {
      return parseInt(id.toString(), 2);
    } catch {
      return 0;
    }
  }).filter(idx => !isNaN(idx) && isFinite(idx));

  const maxIndex = indices.length > 0 ? Math.max(...indices) : 0;
  const nextIndex = maxIndex + 1;
  const nextBinaryString = nextIndex.toString(2);

  return Number(nextBinaryString);
}

/**
 * Generates multiple sequential binary IDs.
 */
export function generateNextBinaryIds(existingIds: number[], count: number): number[] {
  if (count <= 0) return [];
  const results: number[] = [];
  const currentPool = [...existingIds];

  for (let i = 0; i < count; i++) {
    const next = generateNextBinaryId(currentPool);
    results.push(next);
    currentPool.push(next);
  }

  return results;
}
