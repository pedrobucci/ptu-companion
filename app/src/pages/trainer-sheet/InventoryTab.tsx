import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, TrainerProfile } from "../../lib/api";
import { ErrorState, Loading } from "../../components/StateViews";
import { ItemCategoryBadge } from "../../components/ItemCategoryBadge";

const FIXTURE_SHOP_ID = "shop-fixture";

/** Resolves an item's definition to show its real name and category badge
 * (canvas note "pokemon-ui-design-compliance" §3/§9: items use semantic
 * category color, not just a bare id). Tolerant of unresolved ids —
 * shop/backpack items may reference content not present in this pack set,
 * in which case the raw id is shown unstyled rather than erroring. */
function ItemLabel({ itemId }: { itemId: string }) {
  const item = useQuery({
    queryKey: ["item-definition", itemId],
    queryFn: () => api.resolveDefinition("item", itemId),
  });
  const data = item.data?.data_json ? (JSON.parse(item.data.data_json) as Record<string, unknown>) : null;
  const category = typeof data?.category === "string" ? (data.category as string) : null;
  return (
    <span className="button-row" style={{ display: "inline-flex" }}>
      <span>{item.data?.name ?? itemId}</span>
      {category && <ItemCategoryBadge category={category} />}
    </span>
  );
}

/** Flow 9: buy/sell/equip/store items and track money. Uses the shipped
 * `shop-fixture` preset (fixtures/shop_preset.json) as the v1 catalog —
 * see the T08 Worker Result for why a full shop-management UI isn't built. */
export function InventoryTab({ profile, refetch }: { profile: TrainerProfile; refetch: () => void }) {
  const shopQuery = useQuery({ queryKey: ["shop", FIXTURE_SHOP_ID], queryFn: () => api.getShop(FIXTURE_SHOP_ID) });

  const seedShop = useMutation({
    mutationFn: () =>
      api.saveShop(profile.id, {
        id: FIXTURE_SHOP_ID,
        name: "Fixture Poké Mart",
        buy_multiplier: 1.0,
        sell_multiplier: 0.5,
        items: [
          { item_id: "potion", available: true, buy_override: null, sell_override: null },
          { item_id: "poke-ball", available: true, buy_override: 250, sell_override: null },
        ],
      }),
    onSuccess: () => shopQuery.refetch(),
  });

  const buy = useMutation({
    mutationFn: ({ itemId, price }: { itemId: string; price: number }) =>
      api.checkoutBuy(profile.id, FIXTURE_SHOP_ID, [{ item_id: itemId, quantity: 1, unit_price: price }]),
    onSuccess: () => refetch(),
  });

  const sell = useMutation({
    mutationFn: ({ itemId, price }: { itemId: string; price: number }) =>
      api.checkoutSell(profile.id, FIXTURE_SHOP_ID, [{ item_id: itemId, quantity: 1, unit_price: price }]),
    onSuccess: () => refetch(),
  });

  const [slotKey, setSlotKey] = useState("main_hand");
  const [equipItemId, setEquipItemId] = useState("");
  const equip = useMutation({
    mutationFn: () => api.equipItem(profile.id, slotKey, equipItemId.trim()),
    onSuccess: () => {
      setEquipItemId("");
      refetch();
    },
  });
  const unequip = useMutation({
    mutationFn: (slot: string) => api.unequipSlot(profile.id, slot),
    onSuccess: () => refetch(),
  });

  return (
    <div className="sheet-grid">
      <section>
        <h2>Money</h2>
        <p className="money-display">₽{profile.money}</p>
      </section>

      <section>
        <h2>Backpack</h2>
        {profile.inventory.backpack.length === 0 && <p>Empty.</p>}
        <ul>
          {profile.inventory.backpack.map((stack) => (
            <li key={stack.item_id}>
              <ItemLabel itemId={stack.item_id} /> × {stack.quantity}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Equipped</h2>
        <ul>
          {Object.entries(profile.inventory.equipped).map(([slot, itemId]) => (
            <li key={slot}>
              {slot}: <ItemLabel itemId={itemId} />{" "}
              <button type="button" onClick={() => unequip.mutate(slot)} disabled={unequip.isPending}>
                Unequip
              </button>
            </li>
          ))}
        </ul>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (equipItemId.trim()) equip.mutate();
          }}
        >
          <label htmlFor="slot-key">Slot</label>
          <input id="slot-key" value={slotKey} onChange={(e) => setSlotKey(e.currentTarget.value)} />
          <label htmlFor="equip-item">Item id</label>
          <input id="equip-item" value={equipItemId} onChange={(e) => setEquipItemId(e.currentTarget.value)} />
          <button type="submit" disabled={equip.isPending}>
            Equip
          </button>
        </form>
      </section>

      <section>
        <h2>Fixture Poké Mart</h2>
        {shopQuery.isLoading && <Loading label="Loading shop…" />}
        {shopQuery.isError && <ErrorState error={shopQuery.error} onRetry={() => shopQuery.refetch()} />}
        {shopQuery.data === null && (
          <>
            <p>No shop preset saved yet.</p>
            <button type="button" onClick={() => seedShop.mutate()} disabled={seedShop.isPending}>
              Load Fixture Shop Preset
            </button>
          </>
        )}
        {shopQuery.data && (
          <>
            {(buy.isError || sell.isError) && <ErrorState error={buy.error ?? sell.error} />}
            <ul className="shop-list">
              {shopQuery.data.items.map((item) => {
                const buyPrice = item.buy_override ?? 100 * shopQuery.data!.buy_multiplier;
                const sellPrice = item.sell_override ?? 100 * shopQuery.data!.sell_multiplier;
                return (
                  <li key={item.item_id}>
                    <ItemLabel itemId={item.item_id} />
                    <button
                      type="button"
                      onClick={() => buy.mutate({ itemId: item.item_id, price: buyPrice })}
                      disabled={buy.isPending}
                    >
                      Buy for ₽{buyPrice}
                    </button>
                    <button
                      type="button"
                      onClick={() => sell.mutate({ itemId: item.item_id, price: sellPrice })}
                      disabled={sell.isPending}
                    >
                      Sell for ₽{sellPrice}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
