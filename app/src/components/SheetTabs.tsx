import { useId } from "react";
export function SheetTabs({ tabs, value, onChange, label, children }: {
  tabs: { key: string; label: string }[]; value: string; onChange: (key: string) => void;
  label: string; children: React.ReactNode;
}) {
  const id = useId();
  return <>
    <div role="tablist" aria-label={label} className="tab-bar">
      {tabs.map((tab, index) => <button type="button" key={tab.key} role="tab"
        id={`${id}-${tab.key}`} aria-controls={`${id}-panel`} aria-selected={value === tab.key}
        tabIndex={value === tab.key ? 0 : -1} className={`tab-button ${value === tab.key ? "tab-button-active" : ""}`}
        onClick={() => onChange(tab.key)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); onChange(tabs[next].key);
          document.getElementById(`${id}-${tabs[next].key}`)?.focus();
        }}>{tab.label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${value}`} tabIndex={0}>{children}</div>
  </>;
}
