import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeLiteraryTask } from './agent.ts';
import { SkillName } from './skills.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

// Enable standard JSON payload parsing
app.use(express.json());

// Serve premium frontend static application client assets
app.use(express.static(path.join(__dirname, '../public')));

/**
 * REST API Endpoint invoking the autonomous reasoning literary engine.
 * Accepts JSON body: { prompt: string, skill: SkillName }
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, skill } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A valid task prompt string is required.',
      });
    }

    const targetSkill: SkillName = skill || 'stylistic_shift';

    // Execute the core literary agent reasoning cycle (max 8 steps default)
    const result = await executeLiteraryTask(prompt, targetSkill);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Critical internal server error executing reasoning agent:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error encountered during inference generation.',
    });
  }
});

// Fallback all routes to the main index client interface
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`================================================================================`);
  console.log(`  🚀 PRODUCTION LITERARY AGENT WEB SERVER ACTIVE`);
  console.log(`  🌐 Listening on port: ${PORT}`);
  console.log(`  📂 Serving assets from: ${path.join(__dirname, '../public')}`);
  console.log(`================================================================================`);
});
