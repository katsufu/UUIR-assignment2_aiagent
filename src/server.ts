import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeLiteraryTask } from './agent.js';
import { SkillName } from './skills.js';
import { checkSystemHealth } from './heartbeat.js';

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
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, skill, userMemory } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A valid task prompt string is required.',
      });
    }

    const targetSkill: SkillName = skill || 'stylistic_shift';

    // Execute the core literary agent reasoning cycle (max 8 steps default)
    const result = await executeLiteraryTask(prompt, targetSkill, 8, undefined, userMemory);

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

/**
 * Express SSE streaming route for real-time literary agent trace updates.
 * Accepts GET query parameters: ?prompt=...&skill=...
 */
app.get('/api/generate-stream', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const prompt = req.query.prompt as string;
  const skill = (req.query.skill as SkillName) || 'stylistic_shift';
  const userMemory = req.query.userMemory as string | undefined;

  if (!prompt || typeof prompt !== 'string') {
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'A valid task prompt is required.' })}\n\n`);
    res.end();
    return;
  }

  try {
    const result = await executeLiteraryTask(prompt, skill, 8, (stepTrace) => {
      res.write(`data: ${JSON.stringify({ type: 'step', data: stepTrace })}\n\n`);
    }, userMemory);

    res.write(`data: ${JSON.stringify({ type: 'done', data: result })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Critical internal error in streaming endpoint:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'Internal Server Error' })}\n\n`);
    res.end();
  }
});

/**
 * Backend TTS Proxy Endpoint to fetch audio streams from Google Translate TTS.
 * Bypasses client-side CORS and Referer restrictions.
 * Accepts GET query parameter: ?text=...
 */
app.get('/api/tts-proxy', async (req: Request, res: Response) => {
  try {
    const text = req.query.text as string;
    if (!text || typeof text !== 'string') {
      return res.status(400).send('A valid text string parameter is required.');
    }

    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=uk&client=tw-ob&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    if (!response.ok) {
      console.error(`Google Translate TTS responded with status: ${response.status}`);
      return res.status(response.status).send('Failed to fetch speech audio from Google Translate TTS.');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (error: any) {
    console.error('Critical internal server error in TTS proxy endpoint:', error);
    return res.status(500).send('Internal Server Error in TTS proxy.');
  }
});

/**
 * REST Endpoint for system heartbeat and health checks.
 * Completely secure: returns only boolean health statuses, zero configuration leaks.
 */
app.get('/api/heartbeat', (req: Request, res: Response) => {
  const health = checkSystemHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  return res.status(statusCode).json(health);
});

// Fallback all routes to the main index client interface
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`================================================================================`);
  console.log(`  🚀 PRODUCTION LITERARY AGENT WEB SERVER ACTIVE`);
  console.log(`  🌐 Listening on port: ${PORT}`);
  console.log(`  📂 Serving assets from: ${path.join(__dirname, '../public')}`);
  console.log(`================================================================================`);
});
