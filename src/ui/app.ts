import { parseNumbers, parseOps } from "../core/parser";
import { Timeline } from "../core/engine";
import { check } from "../core/checker";
import { grade } from "../core/grader";
import { suggestSequence } from "../core/generator";
import { solve } from "../core/solver";
import type { OpToken } from "../core/types";
import { StackRenderer } from "./render";
import { Animator } from "./animator";
import { wireControls } from "./controls";
import { formatError, renderVerdict, renderMetrics, breakdownOf } from "./panels";
import { t, setLang, getLang, type Lang } from "./i18n";

type Mode = "visualizer" | "solver";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function mountApp(root: HTMLElement): void {
  let mode: Mode = "visualizer";
  let cleanupControls: (() => void) | null = null;
  let cleanupResize: (() => void) | null = null;

  const render = () => {
    if (cleanupControls) { cleanupControls(); cleanupControls = null; }
    if (cleanupResize) { cleanupResize(); cleanupResize = null; }
    root.innerHTML = "";
    root.appendChild(buildLayout());
  };

  function buildLayout(): HTMLElement {
    const el = document.createElement("div");
    el.className = "layout";
    el.innerHTML = `
      <header class="topbar">
        <h1>${esc(t("title"))}</h1>
        <nav class="modes">
          <button data-mode="visualizer" class="${mode === "visualizer" ? "active" : ""}">${esc(t("mode_visualizer"))}</button>
          <button data-mode="solver" class="${mode === "solver" ? "active" : ""}">${esc(t("mode_solver"))}</button>
          <button disabled title="${esc(t("coming_soon"))}">${esc(t("mode_interpreter"))} (${esc(t("coming_soon"))})</button>
        </nav>
        <button id="langToggle">${getLang() === "pt" ? "EN" : "PT"}</button>
      </header>
      <main class="main">
        <section class="inputs">
          <label>${esc(t("numbers_label"))}</label>
          <textarea id="numbers" rows="3"></textarea>
          <div class="suggest-row">
            <select id="size"><option>3</option><option>5</option><option selected>100</option><option>500</option></select>
            <button id="suggest">${esc(t("suggest"))}</button>
          </div>
          <div id="opsBlock" style="${mode === "solver" ? "display:none" : ""}">
            <label>${esc(t("ops_label"))}</label>
            <textarea id="ops" rows="6"></textarea>
          </div>
          <button id="run">${esc(t("run"))}</button>
          <div id="errors" class="errors"></div>
        </section>
        <section class="stage">
          <canvas id="canvas"></canvas>
          <div class="transport">
            <button id="reset">⏮</button>
            <button id="stepBack">◀</button>
            <button id="play">▶</button>
            <button id="stepFwd">▶▶</button>
            <input id="speed" type="range" min="1" max="200" value="8" />
            <input id="scrubber" type="range" min="0" max="0" value="0" />
            <span id="counter" class="counter"></span>
          </div>
        </section>
        <aside class="metrics">
          <div id="verdict" class="verdict"></div>
          <div id="metricsBody"></div>
        </aside>
      </main>
    `;

    el.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.dataset.mode as Mode;
        render();
      }),
    );
    el.querySelector("#langToggle")!.addEventListener("click", () => {
      setLang(getLang() === "pt" ? "en" : ("pt" as Lang));
      render();
    });
    el.querySelector("#suggest")!.addEventListener("click", () => {
      const size = Number((el.querySelector("#size") as HTMLSelectElement).value);
      (el.querySelector("#numbers") as HTMLTextAreaElement).value =
        suggestSequence(size).join(" ");
    });
    el.querySelector("#run")!.addEventListener("click", () => run(el));

    return el;
  }

  function run(el: HTMLElement): void {
    const errorsEl = el.querySelector("#errors") as HTMLElement;
    errorsEl.replaceChildren();

    const numbersRaw = (el.querySelector("#numbers") as HTMLTextAreaElement).value;
    const numbersResult = parseNumbers(numbersRaw);
    if (!numbersResult.ok) {
      for (const e of numbersResult.errors) {
        const div = document.createElement("div");
        div.textContent = formatError(e);
        errorsEl.appendChild(div);
      }
      return;
    }
    const numbers = numbersResult.value;

    let ops: OpToken[];
    if (mode === "solver") {
      ops = solve(numbers);
      const opsArea = el.querySelector("#ops") as HTMLTextAreaElement | null;
      if (opsArea) opsArea.value = ops.join("\n");
    } else {
      const opsRaw = (el.querySelector("#ops") as HTMLTextAreaElement).value;
      const opsResult = parseOps(opsRaw);
      if (!opsResult.ok) {
        for (const e of opsResult.errors) {
          const div = document.createElement("div");
          div.textContent = formatError(e);
          errorsEl.appendChild(div);
        }
        return;
      }
      ops = opsResult.value;
    }

    const timeline = new Timeline(numbers, ops);
    const min = numbers.length ? Math.min(...numbers) : 0;
    const max = numbers.length ? Math.max(...numbers) : 1;

    const canvas = el.querySelector("#canvas") as HTMLCanvasElement;
    const renderer = new StackRenderer(canvas);
    if (cleanupResize) cleanupResize();
    const onResize = () => renderer.resize();
    window.addEventListener("resize", onResize);
    cleanupResize = () => window.removeEventListener("resize", onResize);

    const counter = el.querySelector("#counter") as HTMLElement;
    const scrubber = el.querySelector("#scrubber") as HTMLInputElement;
    const animator = new Animator(timeline, renderer, { min, max }, (index) => {
      scrubber.value = String(index);
      counter.textContent =
        index >= timeline.length
          ? `op ${index} / ${timeline.length}`
          : `op ${index + 1} / ${timeline.length}: ${timeline.opAt(index)}`;
    });

    if (cleanupControls) cleanupControls();
    cleanupControls = wireControls(
      animator,
      {
        play: el.querySelector("#play") as HTMLButtonElement,
        reset: el.querySelector("#reset") as HTMLButtonElement,
        stepBack: el.querySelector("#stepBack") as HTMLButtonElement,
        stepFwd: el.querySelector("#stepFwd") as HTMLButtonElement,
        speed: el.querySelector("#speed") as HTMLInputElement,
        scrubber,
        counter,
      },
      timeline.length,
      (i) => timeline.opAt(i),
    );

    const finalState = timeline.stateAt(timeline.length);
    renderVerdict(el.querySelector("#verdict") as HTMLElement, check(finalState));
    renderMetrics(
      el.querySelector("#metricsBody") as HTMLElement,
      ops.length,
      breakdownOf(ops),
      grade(numbers.length, ops.length),
    );
  }

  render();
}
