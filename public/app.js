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
  generationForm.addEventListener('submit', async (e) => {
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
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      btnTts.textContent = "🔊 Read Aloud";
    }
    btnTts.style.display = 'none';
    if(phoneticsOutputBox) phoneticsOutputBox.style.display = 'none';

    // Transition to loading UI states
    setLoadingState(true);
    traceTimeline.innerHTML = '';
    finalOutputBox.innerHTML = '<p class="placeholder-text">Evaluating linguistic registers and launching agent loop...</p>';

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: compiledPrompt, skill: taskType })
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Server error encountered during task compilation.');
      }

      const { trace, finalText } = resData.data;

      // Extract Phonetics if present
      let displayResult = finalText;
      let phoneticsGuide = "";
      
      const phoneticsMatch = finalText.match(/\[PHONETICS\]([\s\S]*)/);
      if (phoneticsMatch) {
         phoneticsGuide = phoneticsMatch[1].trim();
         displayResult = finalText.replace(/\[PHONETICS\][\s\S]*/, '').trim();
         if(phoneticsOutputBox) phoneticsOutputBox.style.display = 'block';
         if(phoneticsText) phoneticsText.innerHTML = escapeHtml(phoneticsGuide).replace(/\n/g, '<br>');
      }
      
      // Strip [FINAL_OUTPUT] and [DRAFT] tags from UI display
      displayResult = displayResult.replace(/\[FINAL_OUTPUT\]/ig, '').trim();
      displayResult = displayResult.replace(/\[DRAFT \d+\]/ig, '').trim();

      // Inject user condition into trace
      trace.unshift({
        step: 0,
        action: 'reasoning',
        details: `USER CONFIGURATION:\n${compiledPrompt}`
      });

      // Render execution trace smoothly
      renderTraceTimeline(trace);

      // Render polished final result (Simplified)
      finalOutputBox.innerHTML = `<div id="tts-content-wrapper">${escapeHtml(displayResult).replace(/\n/g, '<br>')}</div>`;
      
      // Setup TTS
      cleanFinalTextForTts = displayResult;
      btnTts.style.display = 'block';

    } catch (error) {
      console.error('API Error:', error);
      traceTimeline.innerHTML = `
        <div class="empty-state" style="color: #ef4444;">
          <div class="empty-icon">❌</div>
          <p>Execution failed: ${escapeHtml(error.message)}</p>
        </div>
      `;
      finalOutputBox.innerHTML = `<p style="color: #ef4444;">Failed to output synthesized literary text.</p>`;
    } finally {
      setLoadingState(false);
    }
  });

  // TTS Logic
  btnTts.addEventListener('click', () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      btnTts.textContent = "🔊 Read Aloud";
      return;
    }
    
    btnTts.textContent = "⏹ Stop Reading";
    
    // Wrap words in span for TTS highlighting
    const words = cleanFinalTextForTts.split(/(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()]+)/);
    let wordCount = 0;
    
    const ttsWrapper = document.getElementById('tts-content-wrapper') || finalOutputBox;
    ttsWrapper.innerHTML = words.map(token => {
      if (/^(\s+|[.,\/#!$%\^&\*;:{}=\-_`~()]+)$/.test(token)) {
        if (token.includes('\n')) return token.replace(/\n/g, '<br>');
        return escapeHtml(token);
      }
      const idx = wordCount++;
      return `<span id="tts-word-${idx}">${escapeHtml(token)}</span>`;
    }).join('');

    currentUtterance = new SpeechSynthesisUtterance(cleanFinalTextForTts);
    currentUtterance.lang = 'uk-UA';
    currentUtterance.rate = 0.9; // Slightly slower for poetry
    
    // Attempt to explicitly set Ukrainian voice if available
    const voices = window.speechSynthesis.getVoices();
    const ukVoice = voices.find(v => v.lang.includes('uk'));
    if (ukVoice) currentUtterance.voice = ukVoice;
    
    let wordIndex = 0;
    currentUtterance.onboundary = (event) => {
      if (event.name === 'word') {
         if (wordIndex > 0) {
            const prev = document.getElementById(`tts-word-${wordIndex - 1}`);
            if (prev) {
                prev.style.backgroundColor = 'transparent';
                prev.style.color = 'inherit';
            }
         }
         const curr = document.getElementById(`tts-word-${wordIndex}`);
         if (curr) {
             curr.style.backgroundColor = 'rgba(0, 91, 190, 0.2)';
             curr.style.color = '#005BBE';
             curr.style.borderRadius = '3px';
         }
         wordIndex++;
      }
    };
    
    currentUtterance.onend = () => {
      btnTts.textContent = "🔊 Read Aloud";
      if (wordIndex > 0) {
         const prev = document.getElementById(`tts-word-${wordIndex - 1}`);
         if (prev) {
             prev.style.backgroundColor = 'transparent';
             prev.style.color = 'inherit';
         }
      }
    };
    
    currentUtterance.onerror = (e) => {
      console.warn("TTS Error:", e);
      btnTts.textContent = "🔊 Read Aloud";
      alert("TTS playback failed. Ensure a Ukrainian voice (uk-UA) is installed on your OS.");
    };

    window.speechSynthesis.speak(currentUtterance);
  });

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

      item.innerHTML = `
        <div class="step-icon">${icon}</div>
        <div class="step-content">
          <div class="step-header">
            <span class="step-badge">Step ${step.step}</span>
            <span class="step-action-name">${step.action.toUpperCase()}</span>
          </div>
          <div class="step-details">${escapeHtml(step.details || '')}</div>
        </div>
      `;

      traceTimeline.appendChild(item);
    });

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
