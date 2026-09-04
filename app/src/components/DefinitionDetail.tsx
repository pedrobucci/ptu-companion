import { ResolvedDefinition } from "../lib/api";
import { ItemCategoryBadge } from "./ItemCategoryBadge";
import { MoveCategoryBadge, TypeBadge } from "./TypeBadge";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { IconWarning } from "./icons";

type Data = Record<string, unknown>;

function str(data: Data, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v.trim() ? v : null;
}

/** Fields present across most non-move/species content kinds (edges,
 * features, poke edges, abilities, capabilities, items), in reading order.
 * Every kind in this handoff shares this vocabulary — see T13's Worker
 * Result for the sample records that established it — so one generic list
 * covers all of them instead of a bespoke layout per kind. Only fields
 * that are actually present on a given record render. */
const SECONDARY_TEXT_FIELDS: [key: string, label: string][] = [
  ["prerequisites_text", "Prerequisites"],
  ["cost_text", "Cost"],
  ["trigger_text", "Trigger"],
  ["target_text", "Target"],
  ["bonus_text", "Bonus"],
  ["special_text", "Special"],
  ["condition_text", "Condition"],
  ["limitation_text", "Limitation"],
  ["extra_text", "Additional rules"],
];

function typesOf(data: Data): string[] {
  return Array.isArray(data.types)
    ? (data.types as string[])
    : typeof data.type === "string"
      ? [data.type as string]
      : [];
}

/** Rich, typed rule detail — replaces a raw JSON dump everywhere in the
 * app. `raw_text` (the deterministically-extracted original rule text) is
 * always shown too, never hidden, so nothing this generic layout misses is
 * lost — restart plan A10: "the full rule text ... must be readable inside
 * the app". */
export function DefinitionDetail({ resolved }: { resolved: ResolvedDefinition }) {
  const data = JSON.parse(resolved.data_json) as Data;
  const kind = data.record_kind ?? null;
  const isMove = typeof data.class === "string" && "damage_base" in data;
  const isSpecies = "base_stats" in data || "canonical_types" in data;
  const isItem = typeof data.category === "string" && "price" in data;

  const types = typesOf(data);
  const frequency = str(data, "frequency_text") ?? str(data, "frequency_action_text");
  const effectText = str(data, "effect_text");
  const rawText = str(data, "raw_text");
  const missingFields = Array.isArray(data.missing_mechanical_fields)
    ? (data.missing_mechanical_fields as string[])
    : [];

  return (
    <div className="definition-detail">
      <div className="button-row" style={{ marginBottom: "var(--space-3)" }}>
        {types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
        {isMove && typeof data.class === "string" && <MoveCategoryBadge category={data.class} />}
        {isItem && typeof data.category === "string" && <ItemCategoryBadge category={data.category} />}
      </div>

      {isMove && (
        <dl className="kv-list definition-key-facts">
          <dt>AC</dt>
          <dd>{str(data, "ac_text") ?? "—"}</dd>
          <dt>Frequency</dt>
          <dd>{frequency ?? "—"}</dd>
          <dt>Range</dt>
          <dd>{str(data, "range_text") ?? "—"}</dd>
          <dt>Damage</dt>
          <dd>
            {typeof data.damage_base === "number" ? `DB ${data.damage_base}` : "—"}
            {str(data, "damage_dice") ? ` (${str(data, "damage_dice")})` : ""}
          </dd>
        </dl>
      )}

      {!isMove && !isSpecies && frequency && (
        <dl className="kv-list definition-key-facts">
          <dt>Activation</dt>
          <dd>{frequency}</dd>
        </dl>
      )}

      {isItem && typeof data.price === "number" && (
        <dl className="kv-list definition-key-facts">
          <dt>Price</dt>
          <dd>₽{data.price}</dd>
        </dl>
      )}

      {isSpecies && missingFields.length > 0 && (
        <p className="callout-warning" role="status">
          <IconWarning /> This species entry is missing source data for: {missingFields.join(", ")}. Values here are
          not guessed — they stay blank until a more complete source pack supplies them.
        </p>
      )}

      {resolved.needs_review && (
        <p className="callout-warning" role="status">
          <IconWarning /> This entry is flagged for review — treat the extracted structure as provisional.
        </p>
      )}

      {effectText && (
        <section className="definition-section">
          <h3>Effect</h3>
          <p>{effectText}</p>
        </section>
      )}

      {SECONDARY_TEXT_FIELDS.map(([key, label]) => {
        const value = str(data, key);
        if (!value) return null;
        return (
          <section className="definition-section" key={key}>
            <h3>{label}</h3>
            <p>{value}</p>
          </section>
        );
      })}

      {isMove && (str(data, "contest_type") || str(data, "contest_effect")) && (
        <section className="definition-section">
          <h3>Contest</h3>
          <p>
            {str(data, "contest_type")}
            {str(data, "contest_type") && str(data, "contest_effect") ? " — " : ""}
            {str(data, "contest_effect")}
          </p>
        </section>
      )}

      {isSpecies && (
        <>
          {str(data, "capabilities_text") && (
            <section className="definition-section">
              <h3>Capabilities</h3>
              <p>{str(data, "capabilities_text")}</p>
            </section>
          )}
          {str(data, "skills_text") && (
            <section className="definition-section">
              <h3>Skills</h3>
              <p>{str(data, "skills_text")}</p>
            </section>
          )}
          {str(data, "evolution_text") && (
            <section className="definition-section">
              <h3>Evolution</h3>
              <p>{str(data, "evolution_text")}</p>
            </section>
          )}
        </>
      )}

      {rawText && (
        <section className="definition-section definition-source-text">
          <h3>Source text</h3>
          <p>{rawText}</p>
        </section>
      )}

      <ProvenanceBadge
        variant={resolved.needs_review ? "review" : "info"}
        label={resolved.needs_review ? "Needs review" : `Source: ${resolved.content_pack_id}`}
        detail={
          <p>
            Resolved via {resolved.reason} from pack "{resolved.content_pack_id}"
            {kind ? ` (${kind})` : ""}.
          </p>
        }
      />
    </div>
  );
}
