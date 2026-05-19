import dotenv from 'dotenv';
dotenv.config();

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface ToolCallDefinition {
  name: string;
  arguments: Record<string, any>;
}

export interface BackendResponse {
  content: string;
  toolCalls?: ToolCallDefinition[];
}

/**
 * Interface to communicate with Berget AI Serverless Inference API (Llama 3 models)
 * Configured with base URL https://api.berget.ai/v1
 */
export async function callBergetAI(
  messages: Message[],
  availableTools?: { name: string; description: string; parameters: any }[]
): Promise<BackendResponse> {
  const apiKey = process.env.BERGET_API_KEY;
  const model = process.env.BERGET_MODEL || 'Llama-3.3-70B-Instruct';
  const baseUrl = process.env.BERGET_BASE_URL || 'https://api.berget.ai/v1';

  // If API key is configured, call the actual Berget AI endpoint via standard fetch
  if (apiKey && apiKey.trim() !== '') {
    try {
      const payload: any = {
        model,
        messages,
        temperature: 0.3, // Low temperature for high-precision linguistic tasks
      };

      if (availableTools && availableTools.length > 0) {
        payload.tools = availableTools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
        payload.tool_choice = 'auto';
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Berget AI API Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const message = data.choices[0]?.message;

      let rawContent = message?.content || '';
      // Decode unicode escapes dynamically to fix character corruption
      rawContent = decodeUnicodeEscapes(rawContent);

      const result: BackendResponse = {
        content: rawContent,
      };

      if (message?.tool_calls && message.tool_calls.length > 0) {
        result.toolCalls = message.tool_calls.map((tc: any) => {
          let args = {};
          try {
            // Decode unicode escapes in arguments before parsing
            let decodedArgs = decodeUnicodeEscapes(tc.function.arguments);
            args = JSON.parse(decodedArgs);
          } catch (e) {
            // fallback if arguments string is malformed
          }
          return {
            name: tc.function.name,
            arguments: args,
          };
        });
      } else {
        // Fallback parser for LLMs outputting tool calls directly in raw text instead of standard JSON object
        const parsedToolCalls: ToolCallDefinition[] = [];
        const toolNames = ['synonym_lookup', 'etymology_check', 'reference_ukrlib'];
        
        for (const name of toolNames) {
          const regex = new RegExp(`${name}\\s*\\(\\s*(\\{[\\s\\S]*?\\})\\s*\\)`, 'g');
          let match;
          while ((match = regex.exec(rawContent)) !== null) {
            try {
              let argsStr = match[1];
              // Ensure backslashes are resolved properly for parsing
              argsStr = decodeUnicodeEscapes(argsStr).replace(/(?:\\|¥|Y)u([0-9a-fA-F]{4})/g, '\\u$1');
              const args = JSON.parse(argsStr);
              parsedToolCalls.push({ name, arguments: args });
            } catch (e) {
              console.warn(`[Regex Tool Call Parse Fail] ${name}:`, e);
            }
          }
        }
        
        if (parsedToolCalls.length > 0) {
          result.toolCalls = parsedToolCalls;
        }
      }

      return result;
    } catch (error) {
      console.warn('Berget AI API call failed, falling back to Local Expert Simulation Engine:', error);
      return simulateBergetAI(messages, availableTools);
    }
  }

  // Fallback to sophisticated Local C2 Expert Simulation Engine for testing out of the box
  return simulateBergetAI(messages, availableTools);
}

/**
 * Sophisticated Local C2 Expert Simulation Engine
 * Generates highly realistic responses for creative writing, stylistic shift, rhyme/rhythm analysis, tool calls, and self-critiques.
 */
function simulateBergetAI(
  messages: Message[],
  availableTools?: { name: string; description: string; parameters: any }[]
): BackendResponse {
  const lastMsg = messages[messages.length - 1];

  // 0. Check if requesting final formatting
  if (lastMsg && lastMsg.role === 'user' && lastMsg.content.includes('FINAL_OUTPUT')) {
    return {
      content: `[FINAL_OUTPUT]
Ні, я не здамся під ударом долі,
Хай серце плаче в темній самоті.
(Увага: це згенеровано локальним симулятором)

[PHONETICS]
- Ритмічний малюнок: 5-стопний ямб (- U - U - U)
- Наголоси: здАмся, дОлі, самотІ
- Паузи (цезури): після другої стопи`
    };
  }

  // 1. Check if the loop is requesting a critique evaluation for the latest draft
  if (lastMsg && lastMsg.role === 'system' && lastMsg.content.includes('CRITIQUE STAGE')) {
    const isScenario2 = messages.some((m) => m.content.includes('Rhyme and Rhythm'));
    if (isScenario2) {
      return {
        content: `[CRITIQUE]
Emotional Resonance: 10/10. Excellent atmospheric depiction of the evening steppe.
Linguistic Purity: 10/10. Metrical and phonetic structure perfectly matches classical guidelines.
[DECISION: APPROVE]`
      };
    }

    const isScenario3 = messages.some((m) => m.content.includes('молодіжним') || m.content.includes('експресію'));
    if (isScenario3) {
      return {
        content: `[CRITIQUE]
Emotional Resonance: 10/10. Delivers maximum dynamic energy and authentic youth subculture expression.
Linguistic Purity: 10/10. Slang items are seamlessly integrated into pure Ukrainian syntax and declension paradigms.
[DECISION: APPROVE]`
      };
    }

    const isScenario4 = messages.some((m) => m.content.includes('Лесі Українки'));
    if (isScenario4) {
      return {
        content: `[CRITIQUE]
Emotional Resonance: 10/10. Perfectly captures the neo-romantic, resolute, and defiant spirit characteristic of Lesya Ukrainka.
Linguistic Purity: 10/10. The concept "мрія" is historically precise and stylistically pristine for the late 19th-century literary register.
[DECISION: APPROVE]`
      };
    }

    const hasGeneratedDraft2 = messages.some((m) => m.role === 'assistant' && m.content.includes('[DRAFT 2]'));
    if (!hasGeneratedDraft2) {
      return {
        content: `[CRITIQUE]
Emotional Resonance: 4/10. The text attempts to convey the classical ethos, but the atmosphere is broken by stylistic dissonance.
Linguistic Purity: Deficient. Detected modern anachronisms and internet slang ("хайп", "флешка") which completely destroy the 19th-century classical style of Taras Shevchenko.
[DECISION: REJECT]
Required Refinements: Replace modern slang concepts with authentic period-appropriate lexemes or metaphors (e.g., adapt "hype" as glory/rumor, and "flash drive" as deep unyielding memory).`
      };
    } else {
      return {
        content: `[CRITIQUE]
Emotional Resonance: 10/10. Deep melancholia and longing for the homeland beautifully reflect the genuine spirit of the Kobzar.
Linguistic Purity: 10/10. Exclusive use of authentic native Ukrainian lexemes, perfect metric rhythm.
[DECISION: APPROVE]
The draft meets C2 literary standards and is ready for final presentation.`
      };
    }
  }

  // 2. Check if the user is requesting refinement (Draft 2 generation)
  if (lastMsg && lastMsg.role === 'user' && lastMsg.content.includes('[DRAFT 2]')) {
    return {
      content: `[DRAFT 2]
Думи мої, вітре буйний, рознеси по світоньку,
Принеси козацьку славу у мою хатиноньку.
Памʼять серця не згасає, як зоря у небі,
Лине вільний дух над степом, прагнучи до тебе.`
    };
  }

  // Scenario 3: Slang Translation
  const isScenario3 = messages.some((m) => m.content.includes('молодіжним') || m.content.includes('експресію'));
  if (isScenario3) {
    const hasToolResults = messages.some((m) => m.role === 'tool');
    if (!hasToolResults && availableTools?.some((t) => t.name === 'synonym_lookup')) {
      return {
        content: "To capture authentic modern Gen-Z expression while retaining the primary semantic payload, I will consult the linguistic database for highly expressive contemporary slang equivalents.",
        toolCalls: [
          {
            name: 'synonym_lookup',
            arguments: { word: 'говорити', register: 'slang' },
          },
          {
            name: 'synonym_lookup',
            arguments: { word: 'красивий', register: 'slang' },
          }
        ],
      };
    }

    return {
      content: `[DRAFT 1]
Йоу, Дніпро сьогодні просто в шоці, хвилі люті, вітер зносить дах.
Вайб максимально тривожний, качає ніби на максималках.`
    };
  }

  // Scenario 4: Lesya Ukrainka register
  const isScenario4 = messages.some((m) => m.content.includes('Лесі Українки') || m.content.includes('монолог'));
  if (isScenario4) {
    const hasToolResults = messages.some((m) => m.role === 'tool');
    if (!hasToolResults && availableTools?.some((t) => t.name === 'reference_ukrlib')) {
      return {
        content: "To ensure historical precision and capture the specific cadence of Lesya Ukrainka, I will retrieve reference snippets from the UkrLib digital repository and verify the etymology of the requested concept.",
        toolCalls: [
          {
            name: 'reference_ukrlib',
            arguments: { author: 'Lesya Ukrainka', query: 'доля, мрія, боротьба' },
          },
          {
            name: 'etymology_check',
            arguments: { word: 'мрія' },
          }
        ],
      };
    }

    return {
      content: `[DRAFT 1]
Ні, я не здамся під ударом долі,
Хай серце плаче в темній самоті.
Моя ж бо мрія — мов зоря на волі,
Що світить крізь тумани у житті.`
    };
  }

  // Scenario 1: Stylistic Shift
  const isStylisticShift = messages.some((m) => m.content.includes('Stylistic Shift') || m.content.includes('хайп'));
  if (isStylisticShift) {
    const hasToolResults = messages.some((m) => m.role === 'tool');

    // Automatically invoke tools in the first reasoning step
    if (!hasToolResults && availableTools?.some((t) => t.name === 'reference_ukrlib')) {
      return {
        content: "To ensure absolute stylistic fidelity to Taras Shevchenko and verify suspected borrowings, I will first query the UkrLib digital archive and verify word etymologies.",
        toolCalls: [
          {
            name: 'reference_ukrlib',
            arguments: { author: 'Taras Shevchenko', query: 'думи, доля, степ' },
          },
          {
            name: 'etymology_check',
            arguments: { word: 'хайп' },
          },
          {
            name: 'etymology_check',
            arguments: { word: 'флешка' },
          }
        ],
      };
    }

    // Output Draft 1 once tools have been executed
    return {
      content: `[DRAFT 1]
Реве та стогне Дніпр широкий,
Сердитий вітер завива.
Ой думи мої, думи, лихо мені з вами!
Навколо справжній хайп свободи,
А памʼять в серці як флешка жива.`
    };
  }

  // Scenario 2: Rhyme and Rhythm
  const isRhymeAndRhythm = messages.some((m) => m.content.includes('Rhyme and Rhythm') || m.content.includes('хореєм'));
  if (isRhymeAndRhythm) {
    return {
      content: `[DRAFT 1]
Сонце сідає, вітер стихає,
Степ неозорий в темряві тане.

[PHONETIC AND METRICAL ANALYSIS]
1. Metrical Structure: Four-foot trochee (- U - U - U - U) with feminine clausula.
2. Caesura: Symmetrical rhythmic pause after the second foot ("Сонце сідає // вітер стихає").
3. Rhyme Scheme: AABB paired rhyme, rich exact rhymes ("стихає" - "сідає").
4. Euphony: Optimal alternation of vowels and consonants adhering strictly to Ukrainian euphonic laws.`
    };
  }

  // Generic flawless poetic fallback
  return {
    content: `[DRAFT 1]
Зоре моя вечірняя, зійди над горою,
Поговорим тихесенько в неволі з тобою.
Розкажи, як за горою сонечко сідає,
Як у Дніпра веселочка воду позичає.`
  };
}

/**
 * Decodes Unicode escapes (\uXXXX, ¥uXXXX, YuXXXX) into pure UTF-8 strings.
 */
function decodeUnicodeEscapes(str: string): string {
  if (!str) return '';
  return str.replace(/(?:\\|¥|Y)+u([0-9a-fA-F]{4})/g, (match, grp) => {
    return String.fromCharCode(parseInt(grp, 16));
  });
}

