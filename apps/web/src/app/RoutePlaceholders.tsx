export function PlaceholderPage({ title, nested = false }: { title: string; nested?: boolean }) {
  if (nested) return <h1>{title}</h1>
  return <main><h1>{title}</h1></main>
}
