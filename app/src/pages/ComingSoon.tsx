import { PageHeader } from "../components/PageHeader";
import { Empty } from "../components/StateViews";

/** Navigation-completeness placeholder (T13R2 shell scope only — see
 * T13R1_DESIGN_CONTRACT.md §7): the nav destination table requires every
 * sidebar/bottom-bar item to resolve to a real route ("no clipped/hidden
 * route"), but the real screens for Rosters/Items/Storage/Shop/NPC Journal
 * are T13R3/T17/T18 work, not T13R2. This renders zero fixture/fake data —
 * only the shared PageHeader + Empty primitives — so the nav is honest
 * (a real, reachable route) without pretending a dashboard exists yet. */
export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section>
      <PageHeader title={title} />
      <Empty>{description}</Empty>
    </section>
  );
}
