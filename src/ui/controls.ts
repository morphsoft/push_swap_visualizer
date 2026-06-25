import type { Animator } from "./animator";

export interface ControlRefs {
  play: HTMLButtonElement;
  reset: HTMLButtonElement;
  stepBack: HTMLButtonElement;
  stepFwd: HTMLButtonElement;
  speed: HTMLInputElement;
  scrubber: HTMLInputElement;
  counter: HTMLElement;
}

export function wireControls(
  animator: Animator,
  refs: ControlRefs,
  totalOps: number,
  opLabelAt: (i: number) => string,
): () => void {
  refs.scrubber.min = "0";
  refs.scrubber.max = String(totalOps);
  refs.scrubber.value = "0";

  const updateUi = (index: number) => {
    refs.scrubber.value = String(index);
    refs.play.textContent = animator.playing ? "⏸" : "▶";
    refs.counter.textContent =
      index >= totalOps
        ? `op ${index} / ${totalOps}`
        : `op ${index + 1} / ${totalOps}: ${opLabelAt(index)}`;
  };

  // animator was constructed with an onFrame that calls this via app wiring;
  // here we also refresh on direct control actions.
  const refresh = () => updateUi(animator.index);

  refs.play.addEventListener("click", () => {
    if (animator.playing) animator.pause();
    else animator.play();
    refresh();
  });
  refs.reset.addEventListener("click", () => {
    animator.reset();
    refresh();
  });
  refs.stepFwd.addEventListener("click", () => {
    animator.stepForward();
    refresh();
  });
  refs.stepBack.addEventListener("click", () => {
    animator.stepBack();
    refresh();
  });
  refs.speed.addEventListener("input", () => {
    animator.setSpeed(Number(refs.speed.value));
  });
  refs.scrubber.addEventListener("input", () => {
    animator.seek(Number(refs.scrubber.value));
    refresh();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
      return;
    }
    if (e.key === "ArrowRight") { animator.stepForward(); refresh(); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { animator.stepBack(); refresh(); e.preventDefault(); }
    else if (e.key === " ") {
      if (animator.playing) animator.pause(); else animator.play();
      refresh();
      e.preventDefault();
    }
  };
  window.addEventListener("keydown", onKey);

  updateUi(0);
  return () => window.removeEventListener("keydown", onKey);
}
