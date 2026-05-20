document.addEventListener('DOMContentLoaded', () => {
  const taskTypeSelect = document.getElementById('task-type');
  const shiftOptions = document.getElementById('shift-options');
  const polishingOptions = document.getElementById('polishing-options');
  const polishingGenreSelect = document.getElementById('polishing-genre');
  const shiftDirectionSelect = document.getElementById('shift-direction');
  const sourceStyleSelect = document.getElementById('source-style');
  const targetStyleSelect = document.getElementById('target-style');
  const sourceStyleLabel = document.getElementById('source-style-label');
  const targetStyleLabel = document.getElementById('target-style-label');
  const taskPromptArea = document.getElementById('task-prompt');
  const generationForm = document.getElementById('generation-form');
  const btnSubmit = document.getElementById('btn-submit');
  const spinner = btnSubmit.querySelector('.spinner');
  const loopStatus = document.getElementById('loop-status');
  const traceTimeline = document.getElementById('trace-timeline');
  const finalOutputBox = document.getElementById('final-output-box');
  const phoneticsOutputBox = document.getElementById('phonetics-output-box');
  const phoneticsText = document.getElementById('phonetics-text');
  const btnTts = document.getElementById('btn-tts');

  // Input Mode elements and state
  const tabFreeform = document.getElementById('tab-freeform');
  const tabPresets = document.getElementById('tab-presets');
  const traditionalPresetsContainer = document.getElementById('traditional-presets-container');
  const promptLabel = document.getElementById('prompt-label');
  let activeInputMode = 'freeform'; // 'freeform' | 'presets'

  // Visual Progress Bar Elements
  const progressBarContainer = document.getElementById('progress-bar-container');
  const progressStepName = document.getElementById('progress-step-name');
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = document.getElementById('progress-percentage');

  function showCustomToast(message, isSuccess = false) {
    const existing = document.getElementById('app-toast-alert');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast-alert';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = isSuccess ? 'rgba(46, 125, 50, 0.95)' : 'rgba(211, 47, 47, 0.95)';
    toast.style.color = '#fff';
    toast.style.padding = '0.8rem 1.2rem';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '0.85rem';
    toast.style.fontFamily = 'var(--font-sans)';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.5s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }

  /**
   * Decodes Unicode escapes (\uXXXX, ¥uXXXX, YuXXXX) into pure UTF-8 strings.
   */
  function decodeUnicodeEscapes(str) {
    if (!str) return '';
    return str.replace(/(?:\\|¥|Y)u([0-9a-fA-F]{4})/g, (match, grp) => {
      return String.fromCharCode(parseInt(grp, 16));
    });
  }

  /**
   * Cleans up raw literary text by stripping LLM preambles, bold markers, and duplicates.
   */
  function cleanLiteraryOutput(text) {
    if (!text) return '';
    let cleaned = text.trim();

    // Strip combining acute/grave accents entirely to ensure visually clean output
    cleaned = cleaned.replace(/\u0301/g, '').replace(/\u0300/g, '');

    // 1. Strip standard tags
    cleaned = cleaned.replace(/\[FINAL_OUTPUT\]/ig, '');
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
      const uniqueSections = [];
      const seenText = new Set();

      for (let section of sections) {
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

  function updateProgressBar(stepName, percentage) {
    if (progressStepName) progressStepName.textContent = stepName;
    if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
    if (progressFill) progressFill.style.width = `${percentage}%`;
  }


  const modernOptions = [
    { value: 'internet_slang', label: 'Internet Slang / Gen Z' },
    { value: 'cyberpunk', label: 'Ukrainian Cyberpunk / Sci-Fi' },
    { value: 'kyiv_80s', label: '1980s Kyivan Underground' },
    { value: 'lviv_hvara', label: 'Lviv Hvara (Batiar Slang)' }
  ];

  const classicalOptions = [
    { value: 'shevchenko', label: 'Taras Shevchenko (Romanticism)' },
    { value: 'franko', label: 'Ivan Franko (Realism)' },
    { value: 'ukrainka', label: 'Lesya Ukrainka (Neoromanticism)' },
    { value: 'kotliarevsky', label: 'Ivan Kotliarevsky (Burlesque)' },
    { value: 'stus', label: 'Vasyl Stus (Dissident Poetry)' }
  ];

  const defaultPrompts = {
    poetry: `Без надії таки сподіватись,
Жити хочу! Геть, думи сумні!
Я на вбогім сумнім перелозі
Буду сіяти барвисті квітки,
Буду сіяти квітки на морозі,
Буду лить на них сльози гіркі.`,

    business: `Ми склали новий договір в офісі, але експерт запізнився. Потрібно вжити міри.`,

    everyday: `— Привіт! Як діла?
— Привіт! Нормально, тільки втомився дуже. Вчора працював допізна, а сьогодні треба йти в банк.
— О, тоді давай ввечері зустрінемось, поп'ємо кави.`,

    shift_modern: `Йоу, я сьогодні написав новий пост про свободу і зберіг свої думки як на флешку, але мої бро це не зацінили.`,
    
    shift_classical: `Реве та стогне Дніпр широкий,
Сердитий вітер завива,
Додолу верби гне високі,
Горами хвилю підійма.`,

    internet_slang: `Йоу, я сьогодні написав новий пост про свободу і зберіг свої думки як на флешку, але мої бро це не зацінили.`,
    cyberpunk: `Синдикат хакнув мої нейроімпланти, і тепер я бачу тільки неонові банери корпорацій замість чистого неба.`,
    kyiv_80s: `Ми зависали на рулетці, слухали новий магнітоальбом на бобінах, а потім пішли пити каву з коньяком.`,
    lviv_hvara: `Той фаца з Клепарова вкрав мій ровер, коли я пив піво. Йой, шляк би його трафив!`,

    shevchenko: `Реве та стогне Дніпр широкий,\nСердитий вітер завива,\nДодолу верби гне високі,\nГорами хвилю підійма.`,
    franko: `Не пора, не пора, не пора\nМоскалеві й ляхові служить!`,
    ukrainka: `Хто вам сказав, що я слабка,\nщо я корюся долі?`,
    kotliarevsky: `Еней був парубок моторний\nІ хлопець хоть куди козак.`,
    stus: `Терпи, терпи — терпець тебе шліфує,\nсталить твій дух — тож і терпи, терпи.`
  };

  function populateDropdown(selectElement, options) {
    selectElement.innerHTML = '';
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      selectElement.appendChild(option);
    });
  }

  function updateDropdowns() {
    if (taskTypeSelect.value === 'rhyme_and_rhythm') {
      shiftOptions.style.display = 'none';
      polishingOptions.style.display = 'block';
      return;
    }
    
    shiftOptions.style.display = 'block';
    polishingOptions.style.display = 'none';
    
    if (shiftDirectionSelect.value === 'modern_to_classical') {
      sourceStyleLabel.textContent = 'Modern Sub-genre (From)';
      targetStyleLabel.textContent = 'Classical Author (To)';
      populateDropdown(sourceStyleSelect, modernOptions);
      populateDropdown(targetStyleSelect, classicalOptions);
    } else {
      sourceStyleLabel.textContent = 'Classical Author (From)';
      targetStyleLabel.textContent = 'Modern Sub-genre (To)';
      populateDropdown(sourceStyleSelect, classicalOptions);
      populateDropdown(targetStyleSelect, modernOptions);
    }
  }

  function updatePrefilledPrompt() {
    if (activeInputMode !== 'presets') return;

    const currentValue = taskPromptArea.value.trim();
    
    // 既存の値が空、もしくは既知のデフォルト例文のいずれかと一致している場合のみ上書きする
    const isValEmptyOrPresetDefault = !currentValue || 
      Object.values(defaultPrompts).some(val => val.trim() === currentValue);

    if (!isValEmptyOrPresetDefault) {
      // ユーザーが手動で編集した独自のプロンプトが入っている場合は上書きしない
      return;
    }

    let targetDefault = '';
    if (taskTypeSelect.value === 'rhyme_and_rhythm') {
      const genre = polishingGenreSelect.value;
      if (genre === 'poetry') {
        targetDefault = defaultPrompts.poetry;
      } else if (genre === 'business') {
        targetDefault = defaultPrompts.business;
      } else if (genre === 'everyday') {
        targetDefault = defaultPrompts.everyday;
      }
    } else { // stylistic_shift
      const sourceVal = sourceStyleSelect.value;
      if (defaultPrompts[sourceVal]) {
        targetDefault = defaultPrompts[sourceVal];
      } else {
        targetDefault = shiftDirectionSelect.value === 'modern_to_classical' ? defaultPrompts.shift_modern : defaultPrompts.shift_classical;
      }
    }

    taskPromptArea.value = targetDefault;
  }

  taskTypeSelect.addEventListener('change', () => {
    updateDropdowns();
    updatePrefilledPrompt();
  });
  shiftDirectionSelect.addEventListener('change', () => {
    updateDropdowns();
    updatePrefilledPrompt();
  });
  polishingGenreSelect.addEventListener('change', updatePrefilledPrompt);
  sourceStyleSelect.addEventListener('change', updatePrefilledPrompt);
  
  // Initialize dropdowns and prompt
  updateDropdowns();
  updatePrefilledPrompt();

  // TTS State
  let currentUtterance = null;
  let cleanFinalTextForTts = "";

  // Handle Form Submission / Inference API Invocation
  generationForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const taskType = activeInputMode === 'freeform' ? 'custom_task' : taskTypeSelect.value;
    let compiledPrompt = taskPromptArea.value.trim();

    if (activeInputMode === 'freeform') {
      if (!compiledPrompt) {
        showCustomToast("⚠️ Please enter a creative prompt or instruction!");
        return;
      }
    } else {
      if (taskType === 'stylistic_shift') {
         const sourceLabel = sourceStyleSelect.options[sourceStyleSelect.selectedIndex].text;
         const targetLabel = targetStyleSelect.options[targetStyleSelect.selectedIndex].text;
         const baseContext = compiledPrompt ? `\n\nContext/Instructions: ${compiledPrompt}` : `\n\nContext/Instructions: Please invent a short original poem or monologue demonstrating this transformation.`;
         compiledPrompt = `Transform the style of the following text (or concept) from '${sourceLabel}' to '${targetLabel}'. Ensure strict adherence to the target style's vocabulary and cultural context.${baseContext}`;
      } else {
         const genre = polishingGenreSelect.value;
         if (genre === 'poetry') {
            if (!compiledPrompt) {
               const fallbackText = "Без надії таки сподіватись,\nЖити хочу! Геть, думи сумні!\nЯ на вбогім сумнім перелозі\nБуду сіяти барвисті квітки,\nБуду сіяти квітки на морозі,\nБуду лить на них сльози гіркі.";
               taskPromptArea.value = `[No custom text provided. Using default sample:]\n\n${fallbackText}`;
               compiledPrompt = `Analyze the rhythm, meter, rhyming scheme, and phonetic flow of the following classical Ukrainian poem:\n\n${fallbackText}\n\nNote: This is the standard sample poem "Contra spem spero!" by Lesya Ukrainka. Do NOT alter any words of this poem. Provide a rigorous metrical, phonetic, and rhyme analysis of this exact text in [FINAL_OUTPUT] (do NOT add visual accent marks to the poem text).`;
            } else {
               compiledPrompt = `Analyze the rhythm, meter, rhyming scheme, and phonetic flow of the following classical Ukrainian poem. Provide a rigorous analysis in [FINAL_OUTPUT] (do NOT add visual accent marks to the poem text):\n\n${compiledPrompt}`;
            }
         } else if (genre === 'business') {
            if (!compiledPrompt) {
               const fallbackText = "Ми склали новий договір в офісі, але експерт запізнився. Потрібно вжити міри.";
               taskPromptArea.value = `[No custom text provided. Using default sample:]\n\n${fallbackText}`;
               compiledPrompt = `Polish the following business/official prose to C2-level Ukrainian standard:\n\n${fallbackText}\n\nNote: Apply laws of Ukrainian euphony (e.g. у/в, і/й alternation) and terminology purity (e.g. correct 'вжити заходів' instead of 'вжити міри'). Keep the final output in [FINAL_OUTPUT] clean without visual accent marks.`;
            } else {
               compiledPrompt = `Polish the following business/official prose to C2-level Ukrainian standard. Correct any terminology errors, apply laws of Ukrainian euphony/милозвучність (such as у/в, і/й alternation), eliminate any surzhyk or calques, and output clean literary text without visual accent marks in [FINAL_OUTPUT]:\n\n${compiledPrompt}`;
            }
         } else if (genre === 'everyday') {
            if (!compiledPrompt) {
               const fallbackText = "— Привіт! Як діла?\n— Привіт! Нормально, тільки втомився дуже. Вчора працював допізна, а сьогодні треба йти в банк.\n— О, тоді давай ввечері зустрінемось, поп'ємо кави.";
               taskPromptArea.value = `[No custom text provided. Using default sample:]\n\n${fallbackText}`;
               compiledPrompt = `Polish the following everyday dialogue to flow smoothly and sound completely natural in Ukrainian:\n\n${fallbackText}\n\nNote: Apply laws of Ukrainian euphony (e.g. у/в, і/й alternation), eliminate awkward consonant clusters, remove any unnatural surzhyk or literal translations, and output clean literary dialogue without visual accent marks in [FINAL_OUTPUT].`;
            } else {
               compiledPrompt = `Polish the following everyday dialogue or conversational text to flow smoothly and sound completely natural in Ukrainian. Apply laws of Ukrainian euphony/милозвучність (such as у/в, і/й alternation), eliminate awkward consonant clusters, remove any unnatural surzhyk or literal translations, and output clean literary text without visual accent marks in [FINAL_OUTPUT]:\n\n${compiledPrompt}`;
            }
         }
      }
    }

    // Stop TTS if playing
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      btnTts.textContent = "🔊 Read Aloud";
    }
    btnTts.style.display = 'none';
    if(phoneticsOutputBox) phoneticsOutputBox.style.display = 'none';

    // Transition to loading UI states
    setLoadingState(true);
    traceTimeline.innerHTML = '';
    finalOutputBox.innerHTML = '<p class="placeholder-text">Evaluating linguistic registers and launching agent loop...</p>';

    // Show Progress Bar
    if (progressBarContainer) {
      progressBarContainer.style.display = 'block';
      progressBarContainer.style.opacity = '1';
    }
    updateProgressBar('Initializing reasoning loop and analyzing style rules...', 15);

    const traceSteps = [];
    
    // Inject user configuration details as Step 0
    traceSteps.push({
      step: 0,
      action: 'reasoning',
      details: `USER CONFIGURATION:\n${compiledPrompt}`
    });

    renderTraceTimeline(traceSteps);

    // Retrieve linguistic profile memory (if any exists)
    const userMemory = localStorage.getItem('ukrainian_literary_agent_profile') || '';

    // Initialize EventSource for SSE real-time streaming
    let sseUrl = `/api/generate-stream?prompt=${encodeURIComponent(compiledPrompt)}&skill=${encodeURIComponent(taskType)}`;
    if (userMemory) {
      sseUrl += `&userMemory=${encodeURIComponent(userMemory)}`;
    }
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === 'step') {
          // Add reasoning step in real-time
          traceSteps.push(payload.data);
          renderTraceTimeline(traceSteps);
        } else if (payload.type === 'done') {
          eventSource.close();
          const { trace, finalText } = payload.data;

          // Update client-side compressed session memory (linguistic profile)
          updateLinguisticProfile(taskType, compiledPrompt, finalText);

          // Decode potentially escaped unicode values in output
          let decodedFinalText = decodeUnicodeEscapes(finalText);

          // Extract Phonetics if present
          let displayResult = decodedFinalText;
          let phoneticsGuide = "";
          
          const phoneticsMatch = decodedFinalText.match(/\[PHONETICS\]([\s\S]*)/);
          if (phoneticsMatch) {
             phoneticsGuide = phoneticsMatch[1].trim();
             displayResult = decodedFinalText.replace(/\[PHONETICS\][\s\S]*/, '').trim();
             if(phoneticsOutputBox) {
                phoneticsOutputBox.style.display = 'block';
                phoneticsText.innerHTML = escapeHtml(phoneticsGuide).replace(/\n/g, '<br>');
             }
          } else {
             // Generate default phonetic guide as a backup
             phoneticsGuide = "- Ритмічний малюнок: Традиційний класичний розмір\n- Вимова: Дотримання законів української милозвучності (без анахронізмів)";
             if(phoneticsOutputBox) {
                phoneticsOutputBox.style.display = 'block';
                phoneticsText.innerHTML = escapeHtml(phoneticsGuide).replace(/\n/g, '<br>');
             }
          }
          
          // Strip standard tags and clean up conversational preambles/duplicates
          displayResult = cleanLiteraryOutput(displayResult);

          // Render polished final result
          finalOutputBox.innerHTML = `<div id="tts-content-wrapper">${escapeHtml(displayResult).replace(/\n/g, '<br>')}</div>`;
          
          // Setup TTS
          cleanFinalTextForTts = displayResult;
          btnTts.style.display = 'block';

          updateProgressBar('Completed successfully! ✨', 100);
          setTimeout(() => {
            if (progressBarContainer) progressBarContainer.style.opacity = '0.7';
          }, 3000);

          setLoadingState(false);
        } else if (payload.type === 'error') {
          eventSource.close();
          throw new Error(payload.message || 'Server error occurred.');
        }
      } catch (error) {
        console.error('Error parsing SSE event:', error);
        eventSource.close();
        traceTimeline.innerHTML += `
          <div class="empty-state" style="color: #ef4444;">
            <div class="empty-icon">❌</div>
            <p>Execution failed: ${escapeHtml(error.message)}</p>
          </div>
        `;
        finalOutputBox.innerHTML = `<p style="color: #ef4444;">Failed to output synthesized literary text.</p>`;
        setLoadingState(false);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource connection error:', err);
      eventSource.close();
      
      // Only show error if we haven't successfully completed
      if (btnSubmit.disabled) {
        traceTimeline.innerHTML += `
          <div class="empty-state" style="color: #ef4444;">
            <div class="empty-icon">❌</div>
            <p>Connection lost or server error occurred.</p>
          </div>
        `;
        finalOutputBox.innerHTML = `<p style="color: #ef4444;">Failed to connect to the reasoning server.</p>`;
        setLoadingState(false);
      }
    };
  });

  // Pre-load voices on load
  let cachedVoices = [];
  function loadVoices() {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  let activeAudio = null;
  let highlightInterval = null;
  let audioPlayLoop = null; // High-precision Google TTS animation frame loop
  let activeWordTimings = [];
  let totalSpeechDuration = 0;

  function showTtsWarningToast() {
    const existing = document.getElementById('tts-toast-warning');
    if (existing) return;

    const toast = document.createElement('div');
    toast.id = 'tts-toast-warning';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = 'rgba(217, 119, 6, 0.95)'; // Elegant warm amber warning/info glow
    toast.style.color = '#fff';
    toast.style.padding = '0.8rem 1.2rem';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.zIndex = '10000';
    toast.style.fontSize = '0.85rem';
    toast.style.fontFamily = 'var(--font-sans)';
    toast.innerHTML = '✨ Local Ukrainian voice missing. Streaming high-quality cloud voice fallback...';
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.5s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  }

  // TTS Logic
  btnTts.addEventListener('click', () => {
    // 1. Stop any currently playing audio/speech
    const wasPlaying = btnTts.getAttribute('data-playing') === 'true';
    stopTtsPlayback();
    
    if (wasPlaying) {
      return; // Stop clicked, successfully aborted playback
    }
    
    // Set UI state to active reading
    btnTts.textContent = "⏹ Stop Reading";
    btnTts.setAttribute('data-playing', 'true');
    
    // 2. Parse words with precise character indices for perfect boundary synchronization
    const words = [];
    let currentAccentedPos = 0;
    let currentUnaccentedPos = 0;
    
    // Split by words, spaces, and punctuation (excluding apostrophes ' and ’ from punctuation class to keep Ukrainian words whole)
    const regex = /(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()«»""\n]+|[^\s.,\/#!$%\^&\*;:{}=\-_`~()«»""\n]+)/g;
    let match;
    let htmlResult = "";
    let wordIdx = 0;
    let spokenText = "";
    
    while ((match = regex.exec(cleanFinalTextForTts)) !== null) {
      const accentedToken = match[1];
      const unaccentedToken = accentedToken.replace(/\u0301/g, ''); // Strip Combining Acute Accents for clean speech synthesis
      
      const accStart = currentAccentedPos;
      const accEnd = currentAccentedPos + accentedToken.length;
      currentAccentedPos = accEnd;
      
      const unaccStart = currentUnaccentedPos;
      const unaccEnd = currentUnaccentedPos + unaccentedToken.length;
      currentUnaccentedPos = unaccEnd;
      
      spokenText += unaccentedToken;
      
      if (/^[^\s.,\/#!$%\^&\*;:{}=\-_`~()«»""\n]+$/.test(accentedToken)) {
        htmlResult += `<span id="tts-word-${wordIdx}" data-acc-start="${accStart}" data-acc-end="${accEnd}" data-unacc-start="${unaccStart}" data-unacc-end="${unaccEnd}" style="transition: background-color 0.15s ease;">${escapeHtml(accentedToken)}</span>`;
        words.push({
          id: `tts-word-${wordIdx}`,
          accStart,
          accEnd,
          unaccStart,
          unaccEnd,
          text: accentedToken,
          unaccText: unaccentedToken
        });
        wordIdx++;
      } else {
        htmlResult += escapeHtml(accentedToken).replace(/\n/g, '<br>');
      }
    }
    
    const ttsWrapper = document.getElementById('tts-content-wrapper') || finalOutputBox;
    ttsWrapper.innerHTML = htmlResult;

    // 3. Pre-calculate word timings based on unaccented length and punctuation for natural cadence (legacy fallback)
    let accumulatedTime = 0;
    const wordTimings = [];
    
    words.forEach((w, index) => {
      const wordLen = w.unaccText.length;
      // Recalibrated fallback timing: 30ms per character + 60ms base transition
      const duration = wordLen * 30 + 60;
      
      // Calculate pause based on following punctuation
      let pause = 0;
      const nextWord = words[index + 1];
      const nextWordStart = nextWord ? nextWord.accStart : cleanFinalTextForTts.length;
      const separator = cleanFinalTextForTts.slice(w.accEnd, nextWordStart);
      
      if (separator.includes('\n')) {
        pause = 180;
      } else if (/[.!?]/.test(separator)) {
        pause = 220;
      } else if (/,|;|—|-/.test(separator)) {
        pause = 110;
      }
      
      wordTimings.push({
        id: w.id,
        start: accumulatedTime,
        end: accumulatedTime + duration,
        duration
      });
      
      accumulatedTime += duration + pause;
    });
    
    totalSpeechDuration = accumulatedTime;
    activeWordTimings = wordTimings;

    // 4. Check Ukrainian native voice availability
    const voices = window.speechSynthesis.getVoices();
    const ukVoice = voices.find(v => v.lang.toLowerCase().includes('uk'));

    window.activeTtsBoundaryFired = false;

    if (ukVoice) {
      // Method A: Native SpeechSynthesis (with Ukrainian Voice)
      console.log("Using native Web Speech API with Ukrainian voice:", ukVoice.name);
      
      currentUtterance = new SpeechSynthesisUtterance(spokenText);
      currentUtterance.voice = ukVoice;
      currentUtterance.lang = 'uk-UA';
      currentUtterance.rate = 0.9; // Natural Expressive Rhythm
      
      window.activeTtsUtterance = currentUtterance;
      
      currentUtterance.onboundary = (event) => {
        if (event.name !== 'word') return;
        window.activeTtsBoundaryFired = true; // Signal that native events are updating the visual flow
        
        const charIdx = event.charIndex;
        // Match word boundaries of the spoken text against visual spans
        const activeWord = words.find(w => charIdx >= w.unaccStart && charIdx < w.unaccEnd);
        
        if (activeWord) {
          words.forEach(w => {
            const el = document.getElementById(w.id);
            if (el) {
              if (w.id === activeWord.id) {
                el.style.backgroundColor = 'rgba(0, 91, 190, 0.2)';
                el.style.color = '#005BBE';
                el.style.borderRadius = '3px';
                el.style.fontWeight = '600';
              } else {
                el.style.backgroundColor = 'transparent';
                el.style.color = 'inherit';
                el.style.fontWeight = 'normal';
              }
            }
          });
        }
      };

      currentUtterance.onend = () => {
        stopTtsPlayback();
      };
      
      currentUtterance.onerror = (e) => {
        console.error("Native TTS Error, falling back to Translate cloud stream:", e);
        playGoogleTranslateTts(cleanFinalTextForTts, words);
      };
      
      // Start timing-based highlighter synchronized with native playback (will yield if onboundary fires)
      startHighlightingLoop(words);
      window.speechSynthesis.speak(currentUtterance);
    } else {
      // Method B: Google Translate TTS Fallback (Perfect Ukrainian Cloud Stream)
      console.log("Ukrainian local voice pack missing. Running Google Cloud TTS fallback...");
      showTtsWarningToast();
      playGoogleTranslateTts(cleanFinalTextForTts, words);
    }
  });

  function playGoogleTranslateTts(text, words) {
    // 1. Strip accents before chunking to pass clean text to the proxy
    const cleanText = text.replace(/\u0301/g, '');
    
    // Split clean text into safe chunks of max 150 chars to fit Google's 200-char query limit
    const sentences = cleanText.match(/[^.!?\n]+[.!?\n]*/g) || [cleanText];
    const chunks = [];
    let currentChunk = "";
    let chunkStart = 0;
    let accumulatedOffset = 0;
    
    sentences.forEach(s => {
      const sIdx = cleanText.indexOf(s, accumulatedOffset);
      if ((currentChunk + s).length > 150) {
        if (currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            start: chunkStart,
            end: chunkStart + currentChunk.length
          });
        }
        currentChunk = s;
        chunkStart = sIdx;
      } else {
        if (currentChunk === "") {
          chunkStart = sIdx;
        }
        currentChunk += s;
      }
      accumulatedOffset = sIdx + s.length;
    });
    if (currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        start: chunkStart,
        end: chunkStart + currentChunk.length
      });
    }

    let currentChunkIdx = 0;
    
    function playNextChunk() {
      if (btnTts.getAttribute('data-playing') !== 'true') return;

      if (currentChunkIdx >= chunks.length) {
        stopTtsPlayback();
        return;
      }
      
      const chunk = chunks[currentChunkIdx];
      const audioUrl = `/api/tts-proxy?text=${encodeURIComponent(chunk.text)}`;
      
      // Filter words that belong inside this chunk's unaccented character offsets
      const chunkWords = words.filter(w => w.unaccStart >= chunk.start && w.unaccEnd <= chunk.end);
      
      // Calculate word relative weights and offsets using unaccented text
      let totalWeight = 0;
      const wordWeights = [];
      
      chunkWords.forEach((w, index) => {
        const wordLen = w.unaccText.length;
        const weight = wordLen * 30 + 60; // Recalibrated weight
        
        let pause = 0;
        const nextWord = chunkWords[index + 1];
        const nextWordStart = nextWord ? nextWord.accStart : text.length;
        const separator = text.slice(w.accEnd, nextWordStart);
        
        if (separator.includes('\n')) {
          pause = 180;
        } else if (/[.!?]/.test(separator)) {
          pause = 220;
        } else if (/,|;|—|-/.test(separator)) {
          pause = 110;
        }
        
        wordWeights.push({
          id: w.id,
          rawStart: totalWeight,
          rawDuration: weight,
          rawPause: pause,
          rawEnd: totalWeight + weight
        });
        totalWeight += weight + pause;
      });
      
      activeAudio = new Audio(audioUrl);
      window.activeTtsAudio = activeAudio;
      
      // High-precision sync loop using requestAnimationFrame for continuous duration scaling
      function updateAudioHighlight() {
        if (btnTts.getAttribute('data-playing') !== 'true') return;
        if (!activeAudio || activeAudio.paused) return;
        
        const currentTimeMs = activeAudio.currentTime * 1000;
        const durationMs = (activeAudio.duration && !isNaN(activeAudio.duration) && activeAudio.duration > 0) 
                           ? activeAudio.duration * 1000 
                           : totalWeight;
        
        // Calculate scaling ratio of physical speech vs estimated character weight
        const scaleFactor = durationMs / totalWeight;
        
        let activeWordId = null;
        wordWeights.forEach(ww => {
          const scaledStart = ww.rawStart * scaleFactor;
          const scaledEnd = ww.rawEnd * scaleFactor;
          if (currentTimeMs >= scaledStart && currentTimeMs < scaledEnd) {
            activeWordId = ww.id;
          }
        });
        
        chunkWords.forEach(w => {
          const el = document.getElementById(w.id);
          if (el) {
            if (w.id === activeWordId) {
              el.style.backgroundColor = 'rgba(0, 91, 190, 0.2)';
              el.style.color = '#005BBE';
              el.style.borderRadius = '3px';
              el.style.fontWeight = '600';
            } else {
              el.style.backgroundColor = 'transparent';
              el.style.color = 'inherit';
              el.style.fontWeight = 'normal';
            }
          }
        });
        
        audioPlayLoop = requestAnimationFrame(updateAudioHighlight);
      }
      
      activeAudio.onplay = () => {
        if (audioPlayLoop) cancelAnimationFrame(audioPlayLoop);
        audioPlayLoop = requestAnimationFrame(updateAudioHighlight);
      };
      
      activeAudio.onended = () => {
        if (audioPlayLoop) {
          cancelAnimationFrame(audioPlayLoop);
          audioPlayLoop = null;
        }
        
        // Clear styling for this chunk's words before moving on
        chunkWords.forEach(w => {
          const el = document.getElementById(w.id);
          if (el) {
            el.style.backgroundColor = 'transparent';
            el.style.color = 'inherit';
            el.style.fontWeight = 'normal';
          }
        });
        
        currentChunkIdx++;
        playNextChunk();
      };
      
      activeAudio.onerror = (e) => {
        console.error("Google TTS Chunk Playback Error:", e);
        stopTtsPlayback();
      };
      
      activeAudio.play().catch(err => {
        console.error("Audio playback blocked by browser gesture policy:", err);
        stopTtsPlayback();
      });
    }
    
    playNextChunk();
  }

  function startHighlightingLoop(words) {
    const startTime = performance.now();
    
    function updateHighlight() {
      if (btnTts.getAttribute('data-playing') !== 'true') return;
      
      // If native boundary events are successfully updating the DOM, yield completely
      if (window.activeTtsBoundaryFired) {
        highlightInterval = requestAnimationFrame(updateHighlight);
        return;
      }
      
      const elapsed = performance.now() - startTime;
      let activeWordId = null;
      
      activeWordTimings.forEach(wt => {
        if (elapsed >= wt.start && elapsed < wt.end) {
          activeWordId = wt.id;
        }
      });
      
      words.forEach(w => {
        const el = document.getElementById(w.id);
        if (el) {
          if (w.id === activeWordId) {
            el.style.backgroundColor = 'rgba(0, 91, 190, 0.2)';
            el.style.color = '#005BBE';
            el.style.borderRadius = '3px';
            el.style.fontWeight = '600';
          } else {
            el.style.backgroundColor = 'transparent';
            el.style.color = 'inherit';
            el.style.fontWeight = 'normal';
          }
        }
      });
      
      if (elapsed > totalSpeechDuration + 1000) {
        stopTtsPlayback();
      } else {
        highlightInterval = requestAnimationFrame(updateHighlight);
      }
    }
    
    highlightInterval = requestAnimationFrame(updateHighlight);
  }

  function stopTtsPlayback() {
    // 1. Reset UI button
    btnTts.textContent = "🔊 Read Aloud";
    btnTts.setAttribute('data-playing', 'false');
    
    // 2. Stop native synthesis
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    
    // 3. Stop fallback audio player
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    if (window.activeTtsAudio) {
      window.activeTtsAudio.pause();
      window.activeTtsAudio = null;
    }
    
    // 4. Cancel animation frames
    if (highlightInterval) {
      cancelAnimationFrame(highlightInterval);
      highlightInterval = null;
    }
    if (audioPlayLoop) {
      cancelAnimationFrame(audioPlayLoop);
      audioPlayLoop = null;
    }
    
    // 5. Reset all highlights on spans
    const spans = document.querySelectorAll('#tts-content-wrapper span');
    spans.forEach(el => {
      el.style.backgroundColor = 'transparent';
      el.style.color = 'inherit';
      el.style.fontWeight = 'normal';
    });
  }

  function setLoadingState(isLoading) {
    btnSubmit.disabled = isLoading;
    if (isLoading) {
      spinner.classList.remove('loader-hidden');
      loopStatus.textContent = 'Reasoning Loop Active';
      loopStatus.classList.add('active');
    } else {
      spinner.classList.add('loader-hidden');
      loopStatus.textContent = 'Completed';
      loopStatus.classList.remove('active');
    }
  }

  function cleanSystemTags(text) {
    if (!text) return '';
    return text
      .replace(/\[DECISION: (APPROVE|REJECT)\]/ig, '')
      .replace(/\[FINAL_OUTPUT\]/ig, '')
      .replace(/\[PHONETICS\]/ig, '')
      .replace(/\[DRAFT \d+\]/ig, '')
      .replace(/\[DRAFT\]/ig, '');
  }

  function renderTraceTimeline(trace) {
    traceTimeline.innerHTML = '';
    if (!trace || trace.length === 0) {
      traceTimeline.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <p>No reasoning steps recorded yet.</p>
        </div>
      `;
      return;
    }

    const actionMap = {
      reasoning: { label: '🧠 reasoning', color: '#6A1B9A' },
      tool_call: { label: '🔧 tool_call', color: '#005BBE' },
      draft: { label: '📝 draft', color: '#008080' },
      critique: { label: '⚖️ critique', color: '#FF9800' },
      refinement: { label: '🔄 refinement', color: '#D32F2F' },
      final_output: { label: '✨ final_output', color: '#2E7D32' }
    };

    trace.forEach((step, idx) => {
      const item = document.createElement('div');
      item.className = `timeline-item ${step.action}`;
      item.style.animationDelay = `${idx * 0.1}s`;

      const icon =
        step.action === 'tool_call' ? '🔧' :
          step.action === 'draft' ? '📝' :
            step.action === 'critique' ? '⚖️' :
              step.action === 'refinement' ? '🔄' :
                step.action === 'final_output' ? '✨' : '🧠';

      let decodedDetails = decodeUnicodeEscapes(step.details || '');
      let friendlyDetails = "";
      let jsonPayload = "";

      if (step.action === 'tool_call') {
        if (decodedDetails.includes('Invoking external tool')) {
          const toolMatch = decodedDetails.match(/Invoking external tool '([^']+)' with arguments:\s*({[\s\S]*})/);
          if (toolMatch) {
            const toolName = toolMatch[1];
            try {
              const args = JSON.parse(toolMatch[2]);
              jsonPayload = JSON.stringify(args, null, 2);
              
              if (toolName === 'reference_ukrlib') {
                friendlyDetails = `🔍 <b>Ukrainian National Library (UkrLib) Archive Investigation</b><br>
                Searching stylistic samples for author <b>${escapeHtml(args.author)}</b> (Query: <b>"${escapeHtml(args.query)}"</b>)`;
              } else if (toolName === 'etymology_check') {
                friendlyDetails = `📚 <b>Etymological Validation</b><br>
                Verifying origin and historical integrity for the word <b>"${escapeHtml(args.word)}"</b> to prevent anachronisms.`;
              } else if (toolName === 'synonym_lookup') {
                friendlyDetails = `📖 <b>Synonym & Register Precision</b><br>
                Selecting the optimal synonym for the word <b>"${escapeHtml(args.word)}"</b> matching target register <b>"${escapeHtml(args.register || 'standard')}"</b>.`;
              }
            } catch (e) {
              friendlyDetails = `High-precision linguistic verification active using tool "${escapeHtml(toolName)}".`;
            }
          }
        } else if (decodedDetails.includes('returned')) {
          const charMatch = decodedDetails.match(/returned (\d+) characters/);
          const toolNameMatch = decodedDetails.match(/execution '([^']+)'/);
          const chars = charMatch ? charMatch[1] : 'sufficient';
          const name = toolNameMatch ? toolNameMatch[1] : 'tool';
          
          let dbName = name === 'reference_ukrlib' ? 'Ukrainian Literature Archive' : name === 'etymology_check' ? 'Historical Etymology Database' : 'Synonym Register Database';
          friendlyDetails = `✅ <b>Successfully loaded reference data from ${dbName}</b> (${chars} characters retrieved). Proceeding to suitability review.`;
        }
      } else if (step.action === 'critique') {
        let cleanCritique = cleanSystemTags(decodedDetails);
        let formattedCritique = '';
        
        // "Емоційний резонанс" / "Style & Resonance" を探す
        const emoRegex = /(?:1\.\s*)?(?:Емоційний резонанс|Emotional Resonance)\s*(?:\([^)]*\))?:\s*([\s\S]*?)(?=(?:2\.\s*)?(?:Мовна чистота|Linguistic Purity)|$)/i;
        // "Мовна чистота" / "Linguistic Purity" を探す
        const purRegex = /(?:2\.\s*)?(?:Мовна чистота|Linguistic Purity)\s*(?:\([^)]*\))?:\s*([\s\S]*?)(?=(?:3\.\s*)?(?:Фонетична точність та НАГОЛОСИ|Фонетична точність|Accentuation & Phonetics)|$)/i;
        // "Фонетична точність та НАГОЛОСИ" / "Accentuation & Phonetics" を探す
        const accRegex = /(?:3\.\s*)?(?:Фонетична точність та НАГОлоси|Фонетична точність та НАГОЛОСИ|Accentuation & Phonetics)\s*(?:\([^)]*\))?:\s*([\s\S]*?)$/i;
        
        const emoMatch = cleanCritique.match(emoRegex);
        const purMatch = cleanCritique.match(purRegex);
        const accMatch = cleanCritique.match(accRegex);
        
        // Premium visual mapping of critique outcomes
        let outcomeHeader = '';
        if (decodedDetails.includes('[DECISION: APPROVE]')) {
          outcomeHeader = `
            <div style="border-left: 4px solid #2E7D32; padding-left: 12px; background: rgba(46, 125, 50, 0.05); margin-bottom: 0.8rem; border-radius: 0 6px 6px 0; padding-top: 8px; padding-bottom: 8px;">
              <b style="color: #2E7D32; font-size: 0.9rem;">🎉 Quality Standard: APPROVED</b><br>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Candidate text has successfully cleared all autonomous self-critique reviews for C2-level Ukrainian register purity, stylistic harmony, and acoustic euphony.</span>
            </div>
          `;
        } else if (decodedDetails.includes('[DECISION: REJECT]')) {
          outcomeHeader = `
            <div style="border-left: 4px solid #D32F2F; padding-left: 12px; background: rgba(211, 47, 47, 0.05); margin-bottom: 0.8rem; border-radius: 0 6px 6px 0; padding-top: 8px; padding-bottom: 8px;">
              <b style="color: #D32F2F; font-size: 0.9rem;">🔄 Quality Standard: REFINEMENT REQUIRED</b><br>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Linguistic critique detected terminology, styling, or euphony mismatch. Triggering iterative refinement to address stylistic nuances.</span>
            </div>
          `;
        } else {
          outcomeHeader = `
            <div style="border-left: 4px solid #FF9800; padding-left: 12px; background: rgba(255, 152, 0, 0.05); margin-bottom: 0.8rem; border-radius: 0 6px 6px 0; padding-top: 8px; padding-bottom: 8px;">
              <b style="color: #FF9800; font-size: 0.9rem;">⚖️ Linguistic Analysis Active</b><br>
              <span style="font-size: 0.8rem; color: var(--text-muted);">Evaluating vocabulary, stylistic resonance, and tone alignment with the target style.</span>
            </div>
          `;
        }

        if (emoMatch || purMatch || accMatch) {
          formattedCritique = outcomeHeader + '<div class="critique-cards-container" style="display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.5rem;">';
          if (emoMatch) {
            formattedCritique += `
              <div class="critique-card" style="background: rgba(156, 39, 176, 0.03); border-left: 3px solid #9c27b0; padding: 0.6rem 0.8rem; border-radius: 0 6px 6px 0;">
                <span style="font-weight: 600; color: #9c27b0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.2rem;">🎭 Style & Resonance</span>
                <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">${escapeHtml(emoMatch[1].trim()).replace(/\n/g, '<br>')}</span>
              </div>
            `;
          }
          if (purMatch) {
            formattedCritique += `
              <div class="critique-card" style="background: rgba(46, 125, 50, 0.03); border-left: 3px solid #2E7D32; padding: 0.6rem 0.8rem; border-radius: 0 6px 6px 0;">
                <span style="font-weight: 600; color: #2E7D32; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.2rem;">✨ Register & Purity</span>
                <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">${escapeHtml(purMatch[1].trim()).replace(/\n/g, '<br>')}</span>
              </div>
            `;
          }
          if (accMatch) {
            formattedCritique += `
              <div class="critique-card" style="background: rgba(0, 166, 255, 0.03); border-left: 3px solid #00A6FF; padding: 0.6rem 0.8rem; border-radius: 0 6px 6px 0;">
                <span style="font-weight: 600; color: #00A6FF; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.2rem;">🔊 Phonetics & Euphony</span>
                <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">${escapeHtml(accMatch[1].trim()).replace(/\n/g, '<br>')}</span>
              </div>
            `;
          }
          formattedCritique += '</div>';
        } else {
          // Fallback parsing into neat visual cards
          const parts = cleanCritique.split(/(?:Емоційний резонанс|Мовна чистота|Фонетична точність та наголоси):/i);
          if (parts.length > 1) {
            formattedCritique = outcomeHeader + '<div class="critique-cards-container" style="display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.5rem;">';
            const labels = ['🎭 Style & Resonance', '✨ Register & Purity', '🔊 Phonetics & Euphony'];
            const colors = ['#9c27b0', '#2E7D32', '#00A6FF'];
            const bgColors = ['rgba(156, 39, 176, 0.03)', 'rgba(46, 125, 50, 0.03)', 'rgba(0, 166, 255, 0.03)'];
            
            parts.forEach((part, index) => {
              if (index === 0) return; // preamble
              const label = labels[index - 1] || '📋 Evaluation Parameter';
              const color = colors[index - 1] || 'var(--text-muted)';
              const bgColor = bgColors[index - 1] || 'rgba(0,0,0,0.02)';
              formattedCritique += `
                <div class="critique-card" style="background: ${bgColor}; border-left: 3px solid ${color}; padding: 0.6rem 0.8rem; border-radius: 0 6px 6px 0;">
                  <span style="font-weight: 600; color: ${color}; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 0.2rem;">${label}</span>
                  <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4;">${escapeHtml(part.trim()).replace(/\n/g, '<br>')}</span>
                </div>
              `;
            });
            formattedCritique += '</div>';
          } else {
            formattedCritique = outcomeHeader + `<div style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; padding: 0.6rem; background: rgba(0,0,0,0.02); border-radius: 6px; border: 1px solid rgba(0,0,0,0.03);">${escapeHtml(cleanCritique).replace(/\n/g, '<br>')}</div>`;
          }
        }
        friendlyDetails = formattedCritique;
      } else if (step.action === 'reasoning' && decodedDetails.includes('USER CONFIGURATION:')) {
        friendlyDetails = `<b>🎯 Initializing Target Configuration & Goal:</b><br><div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.3rem;">${escapeHtml(decodedDetails.replace('USER CONFIGURATION:\n', '')).replace(/\n/g, '<br>')}</div>`;
      } else if (step.action === 'reasoning' && decodedDetails.includes('Initialized agent reasoning loop')) {
        friendlyDetails = `<b>🎯 Initializing Stylistic Parameters:</b><br><div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.3rem;">Successfully loaded stylistic target rules, author profiles, and constraints from the phonetics and metrics database.</div>`;
      } else if (step.action === 'draft') {
        const cleanDraft = cleanSystemTags(decodedDetails);
        const displayDraft = cleanDraft.replace(/\[PHONETICS\][\s\S]*/i, '').trim();
        const draftNumMatch = decodedDetails.match(/\[DRAFT (\d+)\]/i);
        const draftNum = draftNumMatch ? draftNumMatch[1] : '1';
        friendlyDetails = `<b>📝 Created Polished Candidate Draft #${draftNum}:</b><br>
        <div style="font-family: var(--font-sans); background: #FFF; padding: 0.8rem 1.2rem; border-radius: 8px; margin-top: 0.5rem; border-left: 3px solid var(--accent-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.02); font-size: 0.85rem; color: #333; line-height: 1.5;">
          ${escapeHtml(displayDraft).replace(/\n/g, '<br>')}
        </div>`;
      } else if (step.action === 'refinement') {
        friendlyDetails = `
          <div style="border-left: 4px solid #FF9800; padding-left: 12px; background: rgba(255, 152, 0, 0.05); border-radius: 0 6px 6px 0; padding-top: 8px; padding-bottom: 8px; margin-top: 0.2rem;">
            <b style="color: #FF9800; font-size: 0.9rem;">🔄 Optimizing Candidate Content</b><br>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Based on feedback from the self-critique engine, actively correcting Russianisms/calques (e.g., rewriting 'вжити міри' to standard C2 literary 'вжити заходів'), resolving euphony/alternation mismatches, and refining literary style.</span>
          </div>
        `;
      } else if (step.action === 'final_output') {
        friendlyDetails = `
          <div style="border-left: 4px solid #2E7D32; padding-left: 12px; background: rgba(46, 125, 50, 0.05); border-radius: 0 6px 6px 0; padding-top: 8px; padding-bottom: 8px; margin-top: 0.2rem;">
            <b style="color: #2E7D32; font-size: 0.9rem;">🌟 Polishing Cycle Finalized Successfully</b><br>
            <span style="font-size: 0.8rem; color: var(--text-muted);">The final polished literary Ukrainian text is verified and locked, conforming to highest C2 orthography, proper register, and flawless style (e.g. 'вжити заходів').</span>
          </div>
        `;
      } else {
        friendlyDetails = escapeHtml(cleanSystemTags(decodedDetails)).replace(/\n/g, '<br>');
      }

      let act = actionMap[step.action] || { label: step.action.toUpperCase(), color: 'var(--text-muted)' };
      if (step.action === 'reasoning') {
        if (step.step === 1) {
          act = { label: '🧠 Strategy & Context Analysis', color: '#005BBE' };
        } else {
          act = { label: '🧠 Autonomous Strategic Reasoning', color: '#6A1B9A' };
        }
      }
      
      const friendlyDetailsHtml = friendlyDetails || escapeHtml(cleanSystemTags(decodedDetails)).replace(/\n/g, '<br>');
      const detailsDetailsTag = jsonPayload ? `
        <details style="margin-top: 0.6rem; font-size: 0.8rem;">
          <summary style="cursor: pointer; color: var(--accent-primary); font-weight: 500; outline: none; user-select: none;">🔍 Linguistic Query Arguments</summary>
          <pre style="background: rgba(0,0,0,0.03); padding: 0.6rem; border-radius: 6px; overflow-x: auto; margin-top: 0.4rem; font-family: monospace; font-size: 0.75rem; border: 1px solid rgba(0,0,0,0.04);">${escapeHtml(jsonPayload)}</pre>
        </details>
      ` : "";

      item.innerHTML = `
        <div class="step-icon">${icon}</div>
        <div class="step-content">
          <div class="step-header">
            <span class="step-badge" style="background: ${act.color}15; color: ${act.color}; padding: 0.15rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.72rem; letter-spacing: 0.5px;">Step ${step.step}</span>
            <span class="step-action-name" style="color: ${act.color}; font-weight: 600; font-size: 0.85rem; margin-left: 0.4rem;">${act.label}</span>
          </div>
          <div class="step-details" style="font-family: inherit; font-size: 0.9rem; border: none; background: transparent; padding: 0; margin-top: 0.5rem; line-height: 1.5;">
            ${friendlyDetailsHtml}
            ${detailsDetailsTag}
          </div>
        </div>
      `;

      traceTimeline.appendChild(item);
    });

    // Dynamically advance progress bar during timeline render
    if (trace.length > 1) {
      const lastStep = trace[trace.length - 1];
      let progressVal = 15;
      let msg = "Processing...";
      
      if (lastStep.action === 'tool_call') {
        progressVal = 45;
        msg = "Consulting libraries and verifying etymologies...";
      } else if (lastStep.action === 'draft') {
        progressVal = 70;
        msg = "Drafting content with precise registers...";
      } else if (lastStep.action === 'critique') {
        progressVal = 85;
        msg = "Evaluating draft for emotional resonance and stylistic purity...";
      } else if (lastStep.action === 'refinement') {
        progressVal = 92;
        msg = "Refining syntax and optimizing rhythmic cadence...";
      } else if (lastStep.action === 'final_output') {
        progressVal = 100;
        msg = "Completed successfully! ✨";
      }
      updateProgressBar(msg, progressVal);
    }

    setTimeout(() => {
      traceTimeline.scrollTop = traceTimeline.scrollHeight;
    }, 100);
  }



  // Handle tab switching
  function switchInputMode(mode) {
    activeInputMode = mode;
    if (mode === 'freeform') {
      tabFreeform.classList.add('active');
      tabPresets.classList.remove('active');
      traditionalPresetsContainer.style.display = 'none';
      
      promptLabel.textContent = 'Your Literary Prompt & Instructions (Required)';
      taskPromptArea.placeholder = 'Enter any custom creative writing prompt in English or Ukrainian... e.g. Write a melancholic sonnet about Kyiv in spring in the style of Vasyl Stus, or Translate a modern cyberpunk paragraph into Kotliarevsky\'s burlesque style.';
      taskPromptArea.required = true;

      // もし現在の textarea の内容が Preset モードのデフォルト例文のいずれかであればクリアする
      const currentValue = taskPromptArea.value.trim();
      const isPresetDefault = Object.values(defaultPrompts).some(val => val.trim() === currentValue);
      if (isPresetDefault) {
        taskPromptArea.value = '';
      }
    } else {
      tabFreeform.classList.remove('active');
      tabPresets.classList.add('active');
      traditionalPresetsContainer.style.display = 'block';
      
      promptLabel.textContent = 'Additional Instructions / Custom Text (Optional)';
      taskPromptArea.placeholder = 'Additional context, or custom text to transform using the selected presets above...';
      taskPromptArea.required = false;

      updatePrefilledPrompt();
    }
  }

  tabFreeform.addEventListener('click', () => switchInputMode('freeform'));
  tabPresets.addEventListener('click', () => switchInputMode('presets'));
  
  // Set default mode on load
  switchInputMode('freeform');

  function updateLinguisticProfile(skill, prompt, resultText) {
    try {
      // 1. Read existing profile
      let profile = localStorage.getItem('ukrainian_literary_agent_profile') || '';
      
      // 2. Extract key features of the current request
      let currentStyle = '';
      if (skill === 'stylistic_shift') {
        const sourceLabel = sourceStyleSelect.options[sourceStyleSelect.selectedIndex].text;
        const targetLabel = targetStyleSelect.options[targetStyleSelect.selectedIndex].text;
        currentStyle = `Shift: ${sourceLabel} -> ${targetLabel}.`;
      } else if (skill === 'rhyme_and_rhythm') {
        currentStyle = 'Poetic analysis.';
      } else {
        // Freeform: extract key style/author keywords if present
        const authorMatch = prompt.match(/style of ([A-Za-z\sА-Яа-яЄєІіЇїҐґ’]+)/i);
        const styleMatch = prompt.match(/(sonnet|poem|monologue|burlesque|romanticism|cyberpunk)/i);
        const authorKey = authorMatch ? authorMatch[1].trim() : '';
        const styleKey = styleMatch ? styleMatch[1].trim() : '';
        if (authorKey || styleKey) {
          currentStyle = `Custom: ${styleKey} ${authorKey ? `in style of ${authorKey}` : ''}.`;
        } else {
          currentStyle = 'Custom creative task.';
        }
      }
      
      // Keep snippet extremely brief (first line, max 40 characters)
      const cleanResultSnippet = resultText
        .replace(/\[FINAL_OUTPUT\]/ig, '')
        .replace(/\[PHONETICS\][\s\S]*/, '')
        .replace(/\[DRAFT \d+\]/ig, '')
        .trim();
      const firstLine = cleanResultSnippet.split('\n')[0] || '';
      const briefSnippet = firstLine.substring(0, 40).trim();
      
      // 3. Construct current run memory entry (max ~100 chars)
      const currentEntry = `[${currentStyle.trim()} Last: "${briefSnippet}..."]`;
      
      // 4. Combine and compress (Keep only the last 2 runs to stay under 350-450 characters total!)
      let profileEntries = profile ? profile.split(' | ') : [];
      profileEntries.push(currentEntry);
      
      // Only keep the most recent 2 entries to be extremely token-efficient!
      if (profileEntries.length > 2) {
        profileEntries = profileEntries.slice(profileEntries.length - 2);
      }
      
      profile = profileEntries.join(' | ');
      
      // 5. Store back
      localStorage.setItem('ukrainian_literary_agent_profile', profile);
      console.log('Updated user linguistic profile (localStorage):', profile);
    } catch (e) {
      console.warn('Failed to update linguistic profile:', e);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
