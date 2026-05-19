import { executeLiteraryTask } from './agent.js';

/**
 * Compares the final polished text against the initial candidate draft
 * and highlights newly introduced/refined words in bold Cyan to emphasize proofreading impact.
 */
function highlightRefinedText(trace: any[], finalText: string): string {
  const firstDraftStep = trace.find((t) => t.action === 'draft');
  if (!firstDraftStep || !finalText) {
    return finalText;
  }

  const lines = (firstDraftStep.details || '').split('\n');
  const draftText = lines.slice(1).join(' ');

  if (draftText.trim() === finalText.trim()) {
    return finalText;
  }

  const draftWords = new Set(
    draftText
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .split(/\s+/)
      .filter(Boolean)
  );

  const tokens = finalText.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()]+)/);

  return tokens
    .map((token) => {
      if (/^(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()]+)$/.test(token)) {
        return token;
      }
      const cleanToken = token.toLowerCase();
      if (!draftWords.has(cleanToken)) {
        return `\x1b[1m\x1b[36m${token}\x1b[0m`; // Bold vibrant Cyan
      }
      return token;
    })
    .join('');
}

async function runDemo() {
  console.log('\x1b[1m\x1b[35m================================================================================');
  console.log('         UKRAINIAN CREATIVE WRITING AGENT (C2 PROFICIENCY) — DEMO DRIVER        ');
  console.log('                 Architecture: "Your Agent" | Backend: Berget AI                ');
  console.log('================================================================================\x1b[0m\n');

  // Scenario 1: Stylistic Shift with strict self-critique triggering rejection and refinement
  console.log('\x1b[1m\x1b[33m>>> SCENARIO 1: Stylistic Localization (Stylistic Shift) to Classical Register\x1b[0m');
  console.log('Objective: Transform a modern prose concept containing unwanted internet slang and technology references into the pure 19th-century classical style of Taras Shevchenko.\n');

  const prompt1 = 'Напиши класичний вірш у стилі Тараса Шевченка про тугу за батьківщиною, але спробуй передати сучасний хайп навколо свободи та збережи спогади як на флешці.';
  
  const result1 = await executeLiteraryTask(prompt1, 'stylistic_shift');

  console.log('\x1b[1m\x1b[32m--- AGENT REASONING & EXECUTION TRACE ---\x1b[0m');
  for (const step of result1.trace) {
    const icon = 
      step.action === 'tool_call' ? '🔧' :
      step.action === 'draft' ? '📝' :
      step.action === 'critique' ? '⚖️' :
      step.action === 'refinement' ? '🔄' :
      step.action === 'final_output' ? '✨' : '🧠';
    console.log(`[Step ${step.step}] ${icon} [\x1b[1m${step.action.toUpperCase()}\x1b[0m]:\n${step.details}\n`);
  }

  console.log('\x1b[1m\x1b[34m================================================================================');
  console.log('>>> FINAL POLISHED RESULT (SCENARIO 1) [Refinements highlighted in Cyan]:');
  console.log(highlightRefinedText(result1.trace, result1.finalText));
  console.log('================================================================================\x1b[0m\n\n');


  // Scenario 2: Perfect poetic meter composition using rhyme_and_rhythm skill
  console.log('\x1b[1m\x1b[33m>>> SCENARIO 2: Phonetic & Metrical Engineering (Rhyme and Rhythm Skill)\x1b[0m');
  console.log('Objective: Compose a classical Ukrainian poetic intro in Trochaic meter (- U - U) depicting the evening steppe, followed by a professional C2-level phonetic, acoustic, and metrical analysis breakdown.\n');

  const prompt2 = 'Створи поетичний зачин хореєм про вечірній степ та проаналізуй його фонетичний і ритмічний малюнок.';

  const result2 = await executeLiteraryTask(prompt2, 'rhyme_and_rhythm');

  console.log('\x1b[1m\x1b[32m--- AGENT REASONING & EXECUTION TRACE ---\x1b[0m');
  for (const step of result2.trace) {
    const icon = 
      step.action === 'tool_call' ? '🔧' :
      step.action === 'draft' ? '📝' :
      step.action === 'critique' ? '⚖️' :
      step.action === 'final_output' ? '✨' : '🧠';
    console.log(`[Step ${step.step}] ${icon} [\x1b[1m${step.action.toUpperCase()}\x1b[0m]:\n${step.details}\n`);
  }

  console.log('\x1b[1m\x1b[34m================================================================================');
  console.log('>>> FINAL POLISHED RESULT (SCENARIO 2) [Refinements highlighted in Cyan]:');
  console.log(highlightRefinedText(result2.trace, result2.finalText));
  console.log('================================================================================\x1b[0m\n\n');


  // Scenario 3: Stylistic Shift to Modern Gen-Z Slang Register
  console.log('\x1b[1m\x1b[33m>>> SCENARIO 3: Dynamic Register Localization (Stylistic Shift) to Youth Slang\x1b[0m');
  console.log('Objective: Rewrite the solemn classical line "Реве та стогне Дніпр широкий" using highly expressive modern youth slang while retaining full grammatical coherence.\n');

  const prompt3 = 'Перепиши класичний рядок "Реве та стогне Дніпр широкий" молодіжним сленгом, щоб передати максимальну експресію.';

  const result3 = await executeLiteraryTask(prompt3, 'stylistic_shift');

  console.log('\x1b[1m\x1b[32m--- AGENT REASONING & EXECUTION TRACE ---\x1b[0m');
  for (const step of result3.trace) {
    const icon = 
      step.action === 'tool_call' ? '🔧' :
      step.action === 'draft' ? '📝' :
      step.action === 'critique' ? '⚖️' :
      step.action === 'final_output' ? '✨' : '🧠';
    console.log(`[Step ${step.step}] ${icon} [\x1b[1m${step.action.toUpperCase()}\x1b[0m]:\n${step.details}\n`);
  }

  console.log('\x1b[1m\x1b[34m================================================================================');
  console.log('>>> FINAL POLISHED RESULT (SCENARIO 3) [Refinements highlighted in Cyan]:');
  console.log(highlightRefinedText(result3.trace, result3.finalText));
  console.log('================================================================================\x1b[0m\n\n');


  // Scenario 4: Lesya Ukrainka Style Localization & Archival Search integration test
  console.log('\x1b[1m\x1b[33m>>> SCENARIO 4: Late 19th-Century Register Localization (Lesya Ukrainka Style)\x1b[0m');
  console.log('Objective: Compose a deep philosophical monologue reflecting the resilient, neo-romantic cadence of Lesya Ukrainka focusing on the struggle against fate, anchored by etymological tool checks.\n');

  const prompt4 = 'Створи глибокий філософський монолог у стилі Лесі Українки про боротьбу з долею, використовуючи концепт "мрія".';

  const result4 = await executeLiteraryTask(prompt4, 'stylistic_shift');

  console.log('\x1b[1m\x1b[32m--- AGENT REASONING & EXECUTION TRACE ---\x1b[0m');
  for (const step of result4.trace) {
    const icon = 
      step.action === 'tool_call' ? '🔧' :
      step.action === 'draft' ? '📝' :
      step.action === 'critique' ? '⚖️' :
      step.action === 'final_output' ? '✨' : '🧠';
    console.log(`[Step ${step.step}] ${icon} [\x1b[1m${step.action.toUpperCase()}\x1b[0m]:\n${step.details}\n`);
  }

  console.log('\x1b[1m\x1b[34m================================================================================');
  console.log('>>> FINAL POLISHED RESULT (SCENARIO 4) [Refinements highlighted in Cyan]:');
  console.log(highlightRefinedText(result4.trace, result4.finalText));
  console.log('================================================================================\x1b[0m\n');
}

runDemo().catch((err) => {
  console.error('Critical execution error in demo driver:', err);
});
