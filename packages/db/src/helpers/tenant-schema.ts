export function toSchemaName(slug: string): string {
  return `t_${slug.replace(/-/g, '_')}`;
}
