/**
 * Typed DOM element accessor that throws if the element is missing,
 * giving a clear error instead of a silent null-dereference.
 *
 * @param id - The element's `id` attribute
 * @returns The element cast to `T`
 * @throws If no element with `id` exists in the document
 */
export function getEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Required DOM element #${id} not found`)
  return el as T
}
