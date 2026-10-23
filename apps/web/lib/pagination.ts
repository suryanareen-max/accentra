export function paginate<T>(items: T[], requestedPage: number, pageSize: number) {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 10;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const start = (page - 1) * size;
  return { page, pages, total: items.length, from: items.length ? start + 1 : 0, to: Math.min(start + size, items.length), items: items.slice(start, start + size) };
}
