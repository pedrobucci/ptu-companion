import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());

// jsdom (as of the version pinned here) implements the <dialog> element's
// `open` attribute reflection but not showModal()/close() — every
// AdaptivePanel usage (move/ability detail, provenance, T13R2's More
// sheet) depends on both, so this is shared test-environment
// infrastructure, not a per-test workaround. Mirrors the platform
// contract closely enough for component tests: showModal marks it open,
// close marks it closed and fires the "close" event AdaptivePanel listens
// for.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom never computes real layout — every element reports 0 for
// clientHeight/getBoundingClientRect, which `@tanstack/react-virtual`
// (Pokedex's search-results list) reads to decide which rows are "in
// view"; with a real 0, it decides none are, so a virtualized list always
// renders empty in tests. Shared infra (T13R3), not a per-test hack: any
// future virtualized-list test hits the same jsdom gap.
Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 600 });
Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 600 });
Element.prototype.getBoundingClientRect = function () {
  return { width: 600, height: 600, top: 0, left: 0, right: 600, bottom: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
};
