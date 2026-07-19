export function publicAsset(name: string): string {
  return `${import.meta.env.BASE_URL}assets/${name}`
}
