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
  
  let systemContext = `${skill.systemInstructions}\n\nCRITICAL DIRECTIVE: You are executing inside an autonomous reasoning loop. Whenever necessary, call tools (e.g., reference_ukrlib, synonym_lookup, etymology_check) to fetch precise linguistic context before outputting final literary text. Provide your generated draft prefaced with [DRAFT 1].`;
  
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
    const isDraft = /\[DRAFT/i.test(replyText) || /Draft/i.test(replyText);
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

      messages.push({
        role: 'system',
        content: `CRITIQUE STAGE: Evaluate the latest draft strictly against C2 literary criteria.
1. Емоційний резонанс (Emotional Resonance): Does it deeply move the reader and align with the specified period/vibe?
2. Мовна чистота (Linguistic Purity): Are there any unwanted modern anachronisms, surzhyk, or inappropriate borrowings?

Output your detailed evaluation. If flawless, conclude exactly with [DECISION: APPROVE]. If adjustments are needed, conclude exactly with [DECISION: REJECT] and state the required refinements.`,
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
        
        // Ask AI for the final formatted output including phonetics
        messages.push({
          role: 'user',
          content: 'Excellent. Now please output the approved text exactly using the [FINAL_OUTPUT] and [PHONETICS] tags as specified in your system instructions.',
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
      if (latestDraft === null) {
        latestDraft = replyText;
      }
      pushTrace(
        'reasoning',
        `Intermediate reasoning state: ${replyText}`
      );
    }
  }

  return {
    finalText: latestDraft || 'Failed to generate final text within step budget.',
    trace,
  };
}
