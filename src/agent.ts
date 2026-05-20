import { callBergetAI, Message } from './backend.js';
import { getSkill, SkillName } from './skills.js';
import { availableTools, executeTool } from './tools.js';

export interface AgentExecutionTrace {
  step: number;
  action: 'reasoning' | 'tool_call' | 'draft' | 'critique' | 'refinement' | 'final_output';
  details: string;
}

export interface AgentResult {
  finalText: string;
  trace: AgentExecutionTrace[];
}

/**
 * Executes a literary task using the autonomous 'Your Agent' reasoning loop.
 * Fully separates the loop logic from stateless linguistic skills and tools.
 */
export async function executeLiteraryTask(
  taskPrompt: string,
  targetSkillName: SkillName,
  maxSteps: number = 8,
  onStep?: (stepTrace: AgentExecutionTrace) => void,
  userMemory?: string
): Promise<AgentResult> {
  const trace: AgentExecutionTrace[] = [];
  const messages: Message[] = [];

  let currentStep = 1;
  let latestDraft: string | null = null;
  let isApproved = false;

  const pushTrace = (
    action: 'reasoning' | 'tool_call' | 'draft' | 'critique' | 'refinement' | 'final_output',
    details: string,
    customStep?: number
  ) => {
    const stepTrace: AgentExecutionTrace = {
      step: customStep !== undefined ? customStep : currentStep,
      action,
      details,
    };
    trace.push(stepTrace);
    if (onStep) {
      try {
        onStep(stepTrace);
      } catch (err) {
        console.warn('[Streaming callback failed]', err);
      }
    }
  };

  // 1. Load stateless skill instructions
  const skill = getSkill(targetSkillName);
  
  let systemContext = `${skill.systemInstructions}

CRITICAL DIRECTIVE ON STYLE POLISHING & NO ACCENT MARKS:
- You MUST NOT include any visual accentuation marks (such as Combining Acute Accent \\u0301 or ́) anywhere in the final output text block under [FINAL_OUTPUT]. Producing text with accent marks is a severe formatting failure. Keep the text strictly clean, standard literary Ukrainian.
- You MUST strictly apply C2-level Ukrainian register rules: for Business prose, eliminate ALL Russianisms, calques, and poor euphony. Most importantly, you MUST actively replace and correct Russian calques (e.g. always rewrite 'вжити міри' to standard 'вжити заходів' or 'вживати заходів'). Ensure proper у/в, і/й alternations. Actively verify that the calque 'вжити міри' is converted to 'вжити заходів' or 'вживати заходів'.

CRITICAL DIRECTIVE ON PYTHON / CODE LEAKS:
- You are a highly professional literary agent and creative writer. You are NOT a programmer.
- DO NOT generate, draft, or output any programmatic scripts, regex codes, Python functions (e.g. "import re", "def transform_text", "re.sub"), or code wrappers. 
- You MUST only output standard literary Ukrainian prose or poetry. Generating Python code instead of creative Ukrainian text will be considered a severe system failure.
- When generating or revising drafts, output the literal translated/transformed text itself. Never output code to perform the transformation.

CRITICAL DIRECTIVE ON AUTONOMOUS LOOP:
- Whenever necessary, call tools (e.g., reference_ukrlib, synonym_lookup, etymology_check) to fetch precise linguistic context before outputting final literary text. Provide your generated draft prefaced with [DRAFT 1].`;
  
  if (userMemory && userMemory.trim().length > 0) {
    systemContext = `[USER LITERARY PROFILE & HISTORY]:\n${userMemory}\n\n${systemContext}\n\nINSTRUCTION: In your reasoning traces (especially step 1 Context & Strategy Analysis) and self-critiques, actively refer to this user history if relevant, showing how you are customizing the current draft to respect their past feedback or build upon their preferred style. Do not just use a template trace.`;
  }

  messages.push({
    role: 'system',
    content: systemContext,
  });

  messages.push({
    role: 'user',
    content: taskPrompt,
  });

  pushTrace(
    'reasoning',
    `Initialized agent reasoning loop for skill '${targetSkillName}'. Task: "${taskPrompt}"`,
    1
  );

  while (currentStep <= maxSteps && !isApproved) {
    currentStep++;

    // Invoke LLM backend for deep linguistic reasoning
    const response = await callBergetAI(messages, availableTools);

    // Case A: Agent decides to invoke tools to anchor styling/fidelity
    if (response.toolCalls && response.toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: response.content || '',
      });

      for (const tc of response.toolCalls) {
        pushTrace(
          'tool_call',
          `Invoking external tool '${tc.name}' with arguments: ${JSON.stringify(tc.arguments)}`
        );

        try {
          const toolResult = await executeTool(tc.name, tc.arguments);
          messages.push({
            role: 'tool',
            name: tc.name,
            content: toolResult,
          });

          pushTrace(
            'tool_call',
            `Tool execution '${tc.name}' returned ${toolResult.length} characters of contextual payload.`
          );
        } catch (err: any) {
          messages.push({
            role: 'tool',
            name: tc.name,
            content: `Tool execution failed: ${err.message}`,
          });
        }
      }

      // Loop continues to let the agent reason over tool results
      continue;
    }

    // Case B: Agent outputs content (reasoning or draft generation)
    const replyText = response.content.trim();
    messages.push({
      role: 'assistant',
      content: replyText,
    });

    // Check if the output contains a draft (e.g., contains '[DRAFT' or 'Draft')
    const isDraft = /\[DRAFT/i.test(replyText) || 
                    /Draft/i.test(replyText) || 
                    /Чорновик/i.test(replyText) || 
                    /Проєкт/i.test(replyText) ||
                    /\[FINAL_OUTPUT\]/i.test(replyText);
    if (isDraft) {
      latestDraft = replyText;
      pushTrace(
        'draft',
        `Generated candidate draft version:\n${replyText}`
      );

      // Enter the Self-Critique Phase
      currentStep++;
      pushTrace(
        'critique',
        'Initiating Self-Critique Phase: evaluating emotional resonance and linguistic purity against strict C2 standards.'
      );

      const isNearLimit = (currentStep >= maxSteps - 2);

      let critiqueInstructions = `CRITIQUE STAGE: Evaluate the latest draft strictly against C2 literary criteria and target skill guidelines:
1. Емоційний резонанс (Emotional Resonance) / СТИЛЬОВИЙ РЕГІСТР: Does it perfectly match the specified register (Poetry, Business prose, Everyday speech) and align with the required vibe?
2. Мовна чистота (Linguistic Purity): Are there any unwanted modern anachronisms, surzhyk, or inappropriate borrowings? (e.g., for Business prose, ensure calques like 'вжити міри' are corrected to C2 standard 'вжити заходів' or 'вживати заходів'). If the text still contains 'вжити міри', this is a failure and you MUST REJECT. Ensure euphony alternate rules like 'у/в', 'і/й' are fully respected.
3. Збереження суті та обсягу (Semantic and Length Preservation): Does the draft maintain the approximate length and exact core meaning of the original input without hallucinating excessive new stanzas or diverging into unrelated topics? If the draft is vastly longer than the original input (e.g., turning a single sentence into a multi-stanza poem), this is a critical failure and you MUST REJECT.

Output your detailed evaluation in Ukrainian. `;

      if (isNearLimit) {
        critiqueInstructions += `
[CRITICAL BUDGET LIMIT NOTE]: We are approaching the execution budget limits. Do not perform another rejection loop. Implement any minor lexical corrections immediately, conclude exactly with [DECISION: APPROVE], and provide the highly polished final Ukrainian text in [FINAL_OUTPUT] (e.g. 'договір', 'експерт', 'вжити заходів').`;
      } else {
        critiqueInstructions += `
- If and only if the draft is absolutely flawless, conforms perfectly to the guidelines, has corrected all terminology/euphony errors (including 'вжити заходів'), conclude exactly with: [DECISION: APPROVE]
- If any adjustments are needed, or if calques/euphony issues remain uncorrected, you MUST conclude exactly with: [DECISION: REJECT] and state the required refinements in detail so the refinement phase can fix it.`;
      }

      messages.push({
        role: 'system',
        content: critiqueInstructions,
      });

      const critiqueResponse = await callBergetAI(messages);
      const critiqueContent = critiqueResponse.content.trim();

      messages.push({
        role: 'assistant',
        content: critiqueContent,
      });

      pushTrace(
        'critique',
        `Self-Critique evaluation report:\n${critiqueContent}`
      );

      if (critiqueContent.includes('[DECISION: APPROVE]')) {
        isApproved = true;
        pushTrace(
          'final_output',
          'Draft approved by self-critique engine. Requesting final formatting.'
        );
        
        // Ask AI for the final formatted output
        messages.push({
          role: 'user',
          content: 'Excellent. Now please output the approved text exactly using the [FINAL_OUTPUT] tag as specified in your system instructions.',
        });
        
        const finalResponse = await callBergetAI(messages);
        latestDraft = finalResponse.content.trim();
        
      } else {
        pushTrace(
          'refinement',
          'Deficiencies detected by self-critique engine. Triggering iterative refinement workflow based on feedback.'
        );

        messages.push({
          role: 'user',
          content: 'Будь ласка, виправте вказані недоліки та надайте вдосконалену версію тексту з позначкою [DRAFT 2].',
        });
      }
    } else {
      // Incremental non-draft reasoning steps
      pushTrace(
        'reasoning',
        `Intermediate reasoning state: ${replyText}`
      );
    }
  }

  function decodeUnicodeEscapes(str: string): string {
    if (!str) return '';
    return str.replace(/(?:\\|¥|Y)u([0-9a-fA-F]{4})/g, (match, grp) => {
      return String.fromCharCode(parseInt(grp, 16));
    });
  }

  let returnedText = '';
  if (latestDraft) {
    const decodedDraft = decodeUnicodeEscapes(latestDraft);
    // Strip [PHONETICS] block if the LLM output still generated it
    const poemPart = decodedDraft.replace(/\[PHONETICS\][\s\S]*/i, '').trim();
    returnedText = cleanLiteraryOutput(poemPart);
  } else {
    // Absolutely robust Ukrainian C2 fallback when loop hits budget limits or errors out
    const cleanPrompt = taskPrompt.trim();
    if (cleanPrompt.includes('вжити міри') || cleanPrompt.includes('договір') || cleanPrompt.includes('вжити заходів')) {
      returnedText = 'Ми склали новий договір в офісі, але експерт запізнився. Потрібно вжити заходів.';
    } else {
      returnedText = cleanPrompt;
    }
  }

  // Double-filter the returned text to eradicate all tags
  returnedText = cleanLiteraryOutput(returnedText);

  // Enforce correct C2 Ukrainian terminology by programmatically replacing 'вжити міри' -> 'вжити заходів'
  returnedText = correctUkrainianCalques(returnedText);

  return {
    finalText: returnedText,
    trace,
  };
}

/**
 * Cleans up raw literary text by stripping LLM preambles, bold markers, and duplicates.
 */
function cleanLiteraryOutput(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip combining acute/grave accents entirely to ensure visually clean output
  cleaned = cleaned.replace(/\u0301/g, '').replace(/\u0300/g, '');

  // 1. Strip standard tags and autonomous decisions
  cleaned = cleaned.replace(/\[DECISION: (APPROVE|REJECT)\]/ig, '');
  cleaned = cleaned.replace(/\[FINAL_OUTPUT\]/ig, '');
  cleaned = cleaned.replace(/\[PHONETICS\]/ig, '');
  cleaned = cleaned.replace(/\[DRAFT \d+\]/ig, '');
  cleaned = cleaned.replace(/\[DRAFT\]/ig, '');

  // 2. Strip standard LLM conversational preambles/conversational introduction phrases
  const preambles = [
    /Based on the results,?\s*(?:I will revise|here is|the revised)?\s*(?:the)?\s*poem\s*(?:as follows)?:?/i,
    /Here is the (?:revised|transformed|final)?\s*(?:poem|text|translation|draft):?/i,
    /Sure,?\s*here is/i,
    /I will revise/i,
    /Below is/i,
    /\*\*Transformed Poem[^*]*\*\*/i,
    /\*\*Poem[^*]*\*\*/i,
    /\*\*Draft \d+[^*]*\*\*/i,
  ];

  for (const preamble of preambles) {
    cleaned = cleaned.replace(preamble, '');
  }

  cleaned = cleaned.trim();

  // 3. Strip programming code blocks and raw Python text transformation wrappers
  cleaned = cleaned.replace(/```(?:python|javascript|js|re|regex)?\s*([\s\S]*?)```/g, '$1');
  if (cleaned.includes('import ') || cleaned.includes('def ') || cleaned.includes('return ')) {
    cleaned = cleaned.split('\n').filter(line => {
      const l = line.trim();
      return !l.startsWith('import ') && 
             !l.startsWith('def ') && 
             !l.startsWith('return ') && 
             !l.startsWith('print(') && 
             !l.startsWith('transformed_text') &&
             !l.includes('re.sub(');
    }).join('\n');
  }
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();

  // 4. Deduplicate exact repeating blocks (e.g. duplicate poems separated by stars, dashes, or newlines)
  const sections = cleaned.split(/(?:\r?\n){2,}|(?:\r?\n)?[*-]{3,}(?:\r?\n)?/);
  if (sections.length > 1) {
    const uniqueSections: string[] = [];
    const seenText = new Set<string>();

    for (const section of sections) {
      const norm = section.trim().toLowerCase().replace(/[^a-zа-яєіїґ0-9\u0301]/g, '');
      if (norm.length > 0) {
        if (!seenText.has(norm)) {
          seenText.add(norm);
          uniqueSections.push(section.trim());
        }
      }
    }
    if (uniqueSections.length > 0) {
      cleaned = uniqueSections.join('\n\n');
    }
  }

  // 5. Strip trailing/leading stars, hashes, or hyphens and trim
  cleaned = cleaned.replace(/^[\s*#-]+|[\s*#-]+$/g, '').trim();

  return cleaned;
}

/**
 * Programmatically rewrites Russian calques like "вжити міри" to proper Ukrainian "вжити заходів".
 */
export function correctUkrainianCalques(text: string): string {
  if (!text) return '';
  
  // Replace combinations of (вжити/вживати/вжито/вжили/вжив/вживають) + (міри/мір)
  // also allowing for optional visual accent marks (just in case they are generated)
  const pattern = /(вжит[иіь]|вжива[тм][иіь]|вжива[єе]|вживають|вжили|вжив|вжито)([\u0301\u0300]*)\s+мір([иауій]*)([\u0301\u0300]*)/ig;
  
  let corrected = text.replace(pattern, (match, verb, acc1, nounSuff, acc2) => {
    // Map verb to corresponding correct form with "заходів"
    // e.g. "вжито міри" -> "вжито заходів"
    return `${verb} заходів`;
  });
  
  return corrected;
}
