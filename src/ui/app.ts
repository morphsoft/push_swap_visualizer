import { parseNumbers, parseOps } from "../core/parser";
import { Timeline } from "../core/engine";
import { check } from "../core/checker";
import { grade } from "../core/grader";
import { suggestSequence } from "../core/generator";
import { solve } from "../core/solver";
import {
  rankMap, theoreticalBound, efficiencyPct, maxBDepth, sortedness, movedElement,
} from "../core/analysis";
import type { OpToken } from "../core/types";
import { StackRenderer, type RenderContext } from "./render";
import { Animator } from "./animator";
import { SoundPlayer } from "./audio";
import { wireControls } from "./controls";
import {
  formatError, renderVerdict, breakdownOf,
  renderExtraMetrics, renderOpChart, renderThresholdGauge, renderProgress,
} from "./panels";
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

const EXAMPLE_NUMBERS = "2 1 3 6 5 8";
const EXAMPLE_OPS = "pb\npb\nsa\npa\npa";

export function mountApp(root: HTMLElement): void {
  let mode: Mode = "visualizer";
  let cleanupControls: (() => void) | null = null;
  let cleanupResize: (() => void) | null = null;
  let currentAnimator: Animator | null = null;
  let soundOn = false;
  let volume = 0.5;
  const sound = new SoundPlayer();

  const render = () => {
    // Stop any in-flight playback before tearing down the DOM, otherwise the
    // old animator's requestAnimationFrame loop keeps running against a
    // detached canvas and piles up on every mode/language switch.
    if (currentAnimator) { currentAnimator.pause(); currentAnimator = null; }
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
        <div class="audio-ctl">
          <button id="soundToggle" class="${soundOn ? "active" : ""}" title="${esc(t("sound"))}">${soundOn ? "🔊" : "🔇"}</button>
          <input id="volume" type="range" min="0" max="1" step="0.01" value="${volume}" title="${esc(t("volume"))}" />
        </div>
        <button id="langToggle">${getLang() === "pt" ? "EN" : "PT"}</button>
      </header>
      <main class="main">
        <section class="panel inputs">
          <label>${esc(t("numbers_label"))}</label>
          <textarea id="numbers" rows="3"></textarea>
          <div class="suggest-row">
            <select id="size"><option>3</option><option>5</option><option selected>100</option><option>500</option></select>
            <button id="suggest">${esc(t("suggest"))}</button>
            <button id="example">${esc(t("load_example"))}</button>
          </div>
          <div id="opsBlock" style="${mode === "solver" ? "display:none" : ""}">
            <label>${esc(t("ops_label"))}</label>
            <textarea id="ops" rows="6"></textarea>
          </div>
          <button id="run" class="run-btn">${esc(t("run"))}</button>
          <div id="errors" class="errors"></div>
        </section>
        <section class="panel stage">
          <div class="readout"><span id="topA" class="top-readout"></span><span id="topB" class="top-readout"></span></div>
          <div class="canvas-wrap">
            <canvas id="canvas"></canvas>
            <div id="hint" class="hint">${esc(t("hint_empty"))}</div>
          </div>
          <div id="progress" class="progress"></div>
          <div class="transport">
            <button id="reset" title="${esc(t("reset"))}">⏮</button>
            <button id="stepBack" title="${esc(t("step_back"))}">◀</button>
            <button id="play" title="${esc(t("play"))}">▶</button>
            <button id="stepFwd" title="${esc(t("step_fwd"))}">▶▶</button>
            <input id="speed" type="range" min="1" max="200" value="8" title="${esc(t("speed"))}" />
            <input id="scrubber" type="range" min="0" max="0" value="0" />
            <span id="counter" class="counter"></span>
          </div>
        </section>
        <aside class="panel metrics">
          <div id="verdict" class="verdict"></div>
          <div id="extraMetrics" class="metric-block"></div>
          <div id="gauge" class="metric-block"></div>
          <div id="opChart" class="metric-block"></div>
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
    el.querySelector("#example")!.addEventListener("click", () => {
      (el.querySelector("#numbers") as HTMLTextAreaElement).value = EXAMPLE_NUMBERS;
      const opsArea = el.querySelector("#ops") as HTMLTextAreaElement | null;
      if (opsArea) opsArea.value = EXAMPLE_OPS;
    });
    const soundBtn = el.querySelector("#soundToggle") as HTMLButtonElement;
    soundBtn.addEventListener("click", () => {
      soundOn = !soundOn;
      sound.resume();
      sound.setEnabled(soundOn);
      soundBtn.classList.toggle("active", soundOn);
      soundBtn.textContent = soundOn ? "🔊" : "🔇";
    });
    const volEl = el.querySelector("#volume") as HTMLInputElement;
    volEl.addEventListener("input", () => {
      volume = Number(volEl.value);
      sound.setVolume(volume);
    });
    sound.setEnabled(soundOn);
    sound.setVolume(volume);

    el.querySelector("#run")!.addEventListener("click", () => run(el));
    return el;
  }

  function readErrors(errorsEl: HTMLElement, errors: { token: string; kind: string; line?: number }[]): void {
    for (const e of errors) {
      const div = document.createElement("div");
      div.textContent = formatError(e as Parameters<typeof formatError>[0]);
      errorsEl.appendChild(div);
    }
  }

  function run(el: HTMLElement): void {
    const errorsEl = el.querySelector("#errors") as HTMLElement;
    errorsEl.replaceChildren();

    const numbersRaw = (el.querySelector("#numbers") as HTMLTextAreaElement).value;
    const numbersResult = parseNumbers(numbersRaw);
    if (!numbersResult.ok) {
      readErrors(errorsEl, numbersResult.errors);
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
        readErrors(errorsEl, opsResult.errors);
        return;
      }
      ops = opsResult.value;
    }

    const hint = el.querySelector("#hint") as HTMLElement | null;
    if (hint) hint.style.display = "none";

    const timeline = new Timeline(numbers, ops);
    const n = numbers.length;
    const min = n ? Math.min(...numbers) : 0;
    const max = n ? Math.max(...numbers) : 1;
    const rankOf = rankMap(numbers);
    const renderContext: RenderContext = { valueRange: { min, max }, rankOf, n };

    const canvas = el.querySelector("#canvas") as HTMLCanvasElement;
    const renderer = new StackRenderer(canvas);

    const counter = el.querySelector("#counter") as HTMLElement;
    const scrubber = el.querySelector("#scrubber") as HTMLInputElement;
    const progressEl = el.querySelector("#progress") as HTMLElement;
    const topAEl = el.querySelector("#topA") as HTMLElement;
    const topBEl = el.querySelector("#topB") as HTMLElement;

    const updateFrame = (index: number) => {
      scrubber.value = String(index);
      counter.textContent =
        index >= timeline.length
          ? `op ${index} / ${timeline.length}`
          : `op ${index + 1} / ${timeline.length}: ${timeline.opAt(index)}`;
      const st = timeline.stateAt(index);
      renderProgress(
        progressEl, index, timeline.length,
        Math.round(sortedness(st) * 100),
      );
      const a0 = st.a[0];
      const b0 = st.b[0];
      topAEl.textContent =
        a0 === undefined ? "A —" : `A.top ${a0} (#${rankOf.get(a0) ?? 0})`;
      topBEl.textContent =
        b0 === undefined ? "B —" : `B.top ${b0} (#${rankOf.get(b0) ?? 0})`;
    };

    // Stop the previous run's animator before starting a new one, so two
    // rAF loops never repaint the same canvas (which made an earlier run
    // "come back" over a new one).
    if (currentAnimator) currentAnimator.pause();
    const animator = new Animator(
      timeline, renderer, renderContext, updateFrame,
      (opIndex) => {
        const before = timeline.stateAt(opIndex);
        const moved = movedElement(before, timeline.opAt(opIndex));
        if (moved !== null) sound.playRank(rankOf.get(moved) ?? 0, n);
      },
    );
    currentAnimator = animator;

    if (cleanupResize) cleanupResize();
    const onResize = () => { renderer.resize(); animator.redraw(); };
    window.addEventListener("resize", onResize);
    cleanupResize = () => window.removeEventListener("resize", onResize);

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

    renderVerdict(el.querySelector("#verdict") as HTMLElement, check(timeline.stateAt(timeline.length)));
    const theoretical = theoreticalBound(n);
    renderExtraMetrics(el.querySelector("#extraMetrics") as HTMLElement, {
      opCount: ops.length,
      efficiencyPct: efficiencyPct(ops.length, n),
      theoretical,
      maxBDepth: maxBDepth(timeline),
      grade: grade(n, ops.length),
    });
    renderThresholdGauge(
      el.querySelector("#gauge") as HTMLElement, n, ops.length, grade(n, ops.length),
    );
    renderOpChart(el.querySelector("#opChart") as HTMLElement, breakdownOf(ops));
  }

  render();
}
