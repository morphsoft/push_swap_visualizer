export type Lang = "pt" | "en";

export const strings = {
  pt: {
    title: "Visualizador Push-Swap",
    mode_visualizer: "Visualizador",
    mode_solver: "Solver",
    mode_interpreter: "Interpretador",
    coming_soon: "em breve",
    numbers_label: "Números",
    ops_label: "Operações",
    suggest: "Sugerir sequência",
    run: "Executar",
    play: "Play",
    pause: "Pausar",
    reset: "Reiniciar",
    step_fwd: "Avançar",
    step_back: "Voltar",
    speed: "Velocidade",
    verdict_ok: "OK",
    verdict_ko: "KO",
    line_prefix: "linha",
    total_ops: "Total de operações",
    sound: "Som",
    volume: "Volume",
    load_example: "Carregar exemplo",
    hint_empty: "Insira números e operações (ou carregue um exemplo) e clique em Executar.",
    efficiency: "Eficiência",
    theoretical: "teórico",
    max_b_depth: "Profundidade máx. B",
    progress: "Progresso",
    sortedness: "Ordenação",
    op_breakdown: "Operações por tipo",
    not_graded: "Sem nota neste tamanho",
    grade_outstanding: "excelente",
    grade_good: "bom",
    grade_needs_work: "precisa melhorar",
    grade_fail: "reprovado",
    err_duplicate: "número duplicado",
    err_non_integer: "não é um inteiro",
    err_out_of_range: "fora do intervalo de int",
    err_unknown_op: "operação inválida",
  },
  en: {
    title: "Push-Swap Visualizer",
    mode_visualizer: "Visualizer",
    mode_solver: "Solver",
    mode_interpreter: "Interpreter",
    coming_soon: "coming soon",
    numbers_label: "Numbers",
    ops_label: "Operations",
    suggest: "Suggest sequence",
    run: "Run",
    play: "Play",
    pause: "Pause",
    reset: "Reset",
    step_fwd: "Step forward",
    step_back: "Step back",
    speed: "Speed",
    verdict_ok: "OK",
    verdict_ko: "KO",
    line_prefix: "line",
    total_ops: "Total operations",
    sound: "Sound",
    volume: "Volume",
    load_example: "Load example",
    hint_empty: "Enter numbers and operations (or load an example), then click Run.",
    efficiency: "Efficiency",
    theoretical: "theoretical",
    max_b_depth: "Max B depth",
    progress: "Progress",
    sortedness: "Sortedness",
    op_breakdown: "Ops by type",
    not_graded: "Not graded at this size",
    grade_outstanding: "outstanding",
    grade_good: "good",
    grade_needs_work: "needs work",
    grade_fail: "fail",
    err_duplicate: "duplicate number",
    err_non_integer: "not an integer",
    err_out_of_range: "out of int range",
    err_unknown_op: "invalid operation",
  },
} as const;

export type StringKey = keyof typeof strings.pt;

let currentLang: Lang = "pt";

export function setLang(l: Lang): void {
  currentLang = l;
}

export function getLang(): Lang {
  return currentLang;
}

export function t(key: StringKey): string {
  return strings[currentLang][key];
}
