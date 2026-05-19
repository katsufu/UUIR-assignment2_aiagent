document.addEventListener('DOMContentLoaded', () => {
  const taskTypeSelect = document.getElementById('task-type');
  const shiftOptions = document.getElementById('shift-options');
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

  // Visual Progress Bar Elements
  const progressBarContainer = document.getElementById('progress-bar-container');
  const progressStepName = document.getElementById('progress-step-name');
  const progressFill = document.getElementById('progress-fill');
  const progressPercentage = document.getElementById('progress-percentage');

  /**
   * Decodes Unicode escapes (\uXXXX, ¥uXXXX, YuXXXX) into pure UTF-8 strings.
   */
  function decodeUnicodeEscapes(str) {
    if (!str) return '';
    return str.replace(/(?:\\|¥|Y)u([0-9a-fA-F]{4})/g, (match, grp) => {
      return String.fromCharCode(parseInt(grp, 16));
    });
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
      return;
    }
    
    shiftOptions.style.display = 'block';
    
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

  taskTypeSelect.addEventListener('change', updateDropdowns);
  shiftDirectionSelect.addEventListener('change', updateDropdowns);
  
  // Initialize dropdowns
  updateDropdowns();

  // TTS State
  let currentUtterance = null;
  let cleanFinalTextForTts = "";

  // Handle Form Submission / Inference API Invocation
  generationForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const taskType = taskTypeSelect.value;
    let compiledPrompt = taskPromptArea.value.trim();

    if (taskType === 'stylistic_shift') {
       const sourceLabel = sourceStyleSelect.options[sourceStyleSelect.selectedIndex].text;
       const targetLabel = targetStyleSelect.options[targetStyleSelect.selectedIndex].text;
       const baseContext = compiledPrompt ? `\n\nContext/Instructions: ${compiledPrompt}` : `\n\nContext/Instructions: Please invent a short original poem or monologue demonstrating this transformation.`;
       compiledPrompt = `Transform the style of the following text (or concept) from '${sourceLabel}' to '${targetLabel}'. Ensure strict adherence to the target style's vocabulary and cultural context.${baseContext}`;
    } else {
       if (!compiledPrompt) {
          compiledPrompt = "Please analyze the rhythm, meter, and phonetics of a classical Ukrainian poem or compose one.";
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

    // Initialize EventSource for SSE real-time streaming
    const sseUrl = `/api/generate-stream?prompt=${encodeURIComponent(compiledPrompt)}&skill=${encodeURIComponent(taskType)}`;
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
          
          // Strip [FINAL_OUTPUT] and [DRAFT] tags from UI display
          displayResult = displayResult.replace(/\[FINAL_OUTPUT\]/ig, '').trim();
          displayResult = displayResult.replace(/\[DRAFT \d+\]/ig, '').trim();

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
    let currentPos = 0;
    
    // Split by words, spaces, and punctuation (excluding apostrophes ' and ’ from punctuation class to keep Ukrainian words whole)
    const regex = /(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()«»""\n]+|[^\s.,\/#!$%\^&\*;:{}=\-_`~()«»""\n]+)/g;
    let match;
    let htmlResult = "";
    let wordIdx = 0;
    
    while ((match = regex.exec(cleanFinalTextForTts)) !== null) {
      const token = match[1];
      const start = currentPos;
      const end = currentPos + token.length;
      currentPos = end;
      
      if (/^[^\s.,\/#!$%\^&\*;:{}=\-_`~()«»""\n]+$/.test(token)) {
        htmlResult += `<span id="tts-word-${wordIdx}" data-start="${start}" data-end="${end}" style="transition: background-color 0.15s ease;">${escapeHtml(token)}</span>`;
        words.push({ id: `tts-word-${wordIdx}`, start, end, text: token });
        wordIdx++;
      } else {
        htmlResult += escapeHtml(token).replace(/\n/g, '<br>');
      }
    }
    
    const ttsWrapper = document.getElementById('tts-content-wrapper') || finalOutputBox;
    ttsWrapper.innerHTML = htmlResult;

    // 3. Pre-calculate word timings based on length and punctuation for natural cadence
    let accumulatedTime = 0;
    const wordTimings = [];
    
    words.forEach((w, index) => {
      const wordLen = w.text.length;
      // Premium timing: 42ms per character + 120ms base transition
      const duration = wordLen * 42 + 120;
      
      // Calculate pause based on following punctuation
      let pause = 0;
      const nextWord = words[index + 1];
      const separator = cleanFinalTextForTts.slice(w.end, nextWord ? nextWord.start : cleanFinalTextForTts.length);
      
      if (separator.includes('\n')) {
        pause = 450;
      } else if (/[.!?]/.test(separator)) {
        pause = 550;
      } else if (/,|;|—|-/.test(separator)) {
        pause = 220;
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

    if (ukVoice) {
      // Method A: Native SpeechSynthesis (with Ukrainian Voice)
      console.log("Using native Web Speech API with Ukrainian voice:", ukVoice.name);
      
      currentUtterance = new SpeechSynthesisUtterance(cleanFinalTextForTts);
      currentUtterance.voice = ukVoice;
      currentUtterance.lang = 'uk-UA';
      currentUtterance.rate = 0.85; // Natural Expressive Rhythm
      
      window.activeTtsUtterance = currentUtterance;
      
      currentUtterance.onend = () => {
        stopTtsPlayback();
      };
      
      currentUtterance.onerror = (e) => {
        console.error("Native TTS Error, falling back to Translate cloud stream:", e);
        playGoogleTranslateTts(cleanFinalTextForTts, words);
      };
      
      // Start timing-based highlighter synchronized with native playback
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
    // 1. Split text into safe chunks of max 150 chars to fit Google's 200-char query limit
    const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
    const chunks = [];
    let currentChunk = "";
    let chunkStart = 0;
    let accumulatedOffset = 0;
    
    sentences.forEach(s => {
      const sIdx = text.indexOf(s, accumulatedOffset);
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
      
      // Filter words that belong inside this chunk's character offsets
      const chunkWords = words.filter(w => w.start >= chunk.start && w.end <= chunk.end);
      
      // Calculate word relative weights
      let totalWeight = 0;
      const wordWeights = [];
      
      chunkWords.forEach((w, index) => {
        const wordLen = w.text.length;
        const weight = wordLen * 42 + 120;
        
        let pause = 0;
        const nextWord = chunkWords[index + 1];
        const nextWordStart = nextWord ? nextWord.start : chunk.end;
        const separator = text.slice(w.end, nextWordStart);
        
        if (separator.includes('\n')) {
          pause = 450;
        } else if (/[.!?]/.test(separator)) {
          pause = 550;
        } else if (/,|;|—|-/.test(separator)) {
          pause = 220;
        }
        
        wordWeights.push({
          id: w.id,
          durationWeight: weight,
          pauseWeight: pause,
          totalWeight: weight + pause
        });
        totalWeight += weight + pause;
      });
      
      // Normalize word timings as percentages
      let accumulatedWeight = 0;
      const wordNormalizedTimings = [];
      wordWeights.forEach(ww => {
        const startPct = accumulatedWeight / totalWeight;
        const endPct = (accumulatedWeight + ww.durationWeight) / totalWeight;
        accumulatedWeight += ww.totalWeight;
        
        wordNormalizedTimings.push({
          id: ww.id,
          startPct,
          endPct
        });
      });
      
      activeAudio = new Audio(audioUrl);
      window.activeTtsAudio = activeAudio;
      
      activeAudio.addEventListener('timeupdate', () => {
        if (btnTts.getAttribute('data-playing') !== 'true') return;
        const currentTime = activeAudio.currentTime;
        const duration = activeAudio.duration || (totalWeight / 1000);
        const currentPct = currentTime / duration;
        
        let activeWordId = null;
        wordNormalizedTimings.forEach(wt => {
          if (currentPct >= wt.startPct && currentPct < wt.endPct) {
            activeWordId = wt.id;
          }
        });
        
        // Update styling for this chunk's words
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
      });
      
      activeAudio.onended = () => {
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
    
    // 4. Cancel animation frame
    if (highlightInterval) {
      cancelAnimationFrame(highlightInterval);
      highlightInterval = null;
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
  function renderTraceTimeline(trace) {
    if (!trace || trace.length === 0) {
      traceTimeline.innerHTML = '<p class="placeholder-text">No trace history recorded.</p>';
      return;
    }

    traceTimeline.innerHTML = '';

    // Action translation mapping with premium aesthetics
    const actionMap = {
      'reasoning': { label: '🧠 Context & Strategy Analysis', color: '#005BBE' },
      'tool_call': { label: '🔍 Database & Archive Consultation', color: '#D32F2F' },
      'draft': { label: '📝 Candidate Poem Synthesis', color: '#9c27b0' },
      'critique': { label: '⚖️ Standard Self-Critique', color: '#FF9800' },
      'refinement': { label: '🔄 Rhythmic & Stylistic Refinement', color: '#00A6FF' },
      'final_output': { label: '✨ Final Literary Presentation', color: '#2E7D32' }
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
                friendlyDetails = `Searching and analyzing stylistic samples of classical author <b>${escapeHtml(args.author)}</b> matching the query/concept <b>"${escapeHtml(args.query)}"</b> from the Ukrainian National Library (UkrLib) archives.`;
              } else if (toolName === 'etymology_check') {
                friendlyDetails = `Historical Vocabulary Verification: Checking etymology and historical introduction of the word <b>"${escapeHtml(args.word)}"</b> to eliminate anachronisms.`;
              } else if (toolName === 'synonym_lookup') {
                friendlyDetails = `Lexical Precision: Listing synonyms for the word <b>"${escapeHtml(args.word)}"</b> matching the stylistic register <b>"${escapeHtml(args.register || 'standard')}"</b>.`;
              }
            } catch (e) {
              friendlyDetails = `Executing high-precision linguistic verification using external tool "${escapeHtml(toolName)}".`;
            }
          }
        } else if (decodedDetails.includes('returned')) {
          const charMatch = decodedDetails.match(/returned (\d+) characters/);
          const toolNameMatch = decodedDetails.match(/execution '([^']+)'/);
          const chars = charMatch ? charMatch[1] : 'sufficient';
          const name = toolNameMatch ? toolNameMatch[1] : 'tool';
          
          let toolNameEn = name === 'reference_ukrlib' ? 'UkrLib Reference Archive' : name === 'etymology_check' ? 'Etymological Database' : 'Synonym Database';
          friendlyDetails = `✅ Successfully loaded verification data from <b>${toolNameEn}</b> (Received: ${chars} characters). Proceeding to context compliance scoring.`;
        }
      } else if (step.action === 'critique') {
        if (decodedDetails.includes('[DECISION: APPROVE]')) {
          friendlyDetails = `<div style="border-left: 4px solid #2E7D32; padding-left: 10px; background: rgba(46, 125, 50, 0.05); margin-bottom: 0.6rem; border-radius: 0 4px 4px 0;">
            <b style="color: #2E7D32;">🎉 Evaluation Outcome: APPROVED</b><br>
            The candidate meets the rigorous criteria for stylistic resonance, metrical fidelity, and linguistic purity (C2 Ukrainian standard). Synthesized output approved for final presentation!
          </div>`;
        } else if (decodedDetails.includes('[DECISION: REJECT]')) {
          friendlyDetails = `<div style="border-left: 4px solid #D32F2F; padding-left: 10px; background: rgba(211, 47, 47, 0.05); margin-bottom: 0.6rem; border-radius: 0 4px 4px 0;">
            <b style="color: #D32F2F;">⚠️ Evaluation Outcome: REJECTED (Refinement Needed)</b><br>
            Self-critique identified subtle register drift, metrical deviation, or non-authentic loanwords. Transitioning to refinement phase.
          </div>`;
        }
        friendlyDetails += `<div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; padding: 0.5rem; background: rgba(0,0,0,0.02); border-radius: 4px;">${escapeHtml(decodedDetails).replace(/\n/g, '<br>')}</div>`;
      } else if (step.action === 'reasoning' && decodedDetails.includes('USER CONFIGURATION:')) {
        friendlyDetails = `<b>🎯 Initializing User Configuration & Goal:</b><br><div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.3rem;">${escapeHtml(decodedDetails.replace('USER CONFIGURATION:\n', '')).replace(/\n/g, '<br>')}</div>`;
      } else if (step.action === 'draft') {
        const draftNumMatch = decodedDetails.match(/\[DRAFT (\d+)\]/);
        const draftNum = draftNumMatch ? draftNumMatch[1] : '1';
        friendlyDetails = `<b>📝 Synthesized Draft #${draftNum}:</b><br>
        <div style="font-family: var(--font-display); font-style: italic; background: #FFF; padding: 0.8rem 1.2rem; border-radius: 8px; margin-top: 0.5rem; border-left: 3px solid var(--accent-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          ${escapeHtml(decodedDetails.replace(/\[DRAFT \d+\]\n?/g, '')).replace(/\n/g, '<br>')}
        </div>`;
      } else {
        friendlyDetails = escapeHtml(decodedDetails).replace(/\n/g, '<br>');
      }

      const act = actionMap[step.action] || { label: step.action.toUpperCase(), color: 'var(--text-muted)' };
      const friendlyDetailsHtml = friendlyDetails || escapeHtml(decodedDetails).replace(/\n/g, '<br>');
      const detailsDetailsTag = jsonPayload ? `
        <details style="margin-top: 0.6rem; font-size: 0.8rem;">
          <summary style="cursor: pointer; color: var(--accent-primary); font-weight: 500; outline: none; user-select: none;">🔍 Raw JSON Payload (Developer View)</summary>
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
        msg = "Drafting poetic content with precise registers...";
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
