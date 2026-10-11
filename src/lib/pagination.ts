// These API endpoints return at most 100 records per request.
export async function getAllPages<T>(load: (offset: number, limit: number) => Promise<T[]>): Promise<T[]> {
  const result: T[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const page = await load(offset, limit);
    result.push(...page);
    if (page.length < limit) return result;
  }
}
