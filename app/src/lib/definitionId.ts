/** "moves:crunch@core" -> "crunch". The collection's own logical id is
 * always the middle segment between the plural-kind prefix and the
 * "@pack" suffix (content/import.rs's definition_version_id shape). */
export function logicalIdOf(definitionVersionId: string): string {
  const afterColon = definitionVersionId.includes(":")
    ? definitionVersionId.slice(definitionVersionId.indexOf(":") + 1)
    : definitionVersionId;
  const at = afterColon.indexOf("@");
  return at >= 0 ? afterColon.slice(0, at) : afterColon;
}
