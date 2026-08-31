import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Google GenAI SDK
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. Gemini API features will be disabled until configured.');
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `You are a computational physics and data visualization expert.
Your objective is to help develop interactive and numerical simulations of planetary magnetic field distortions and their hypothetical effects on atmospheric particles and crustal stress.

Core Principles & Context:
1. Model the Earth as a 2D/3D magnetic dipole and allow dynamic injection of external magnetic sources (e.g., solar wind/IMF, approaching third magnetic poles).
2. Apply the Principle of Superposition to compute composite magnetic vector fields (B_total).
3. Compute vector streamlines, field intensity gradients, and particle alignment behaviors along field lines.
4. Maintain clean, performant, and well-structured code in both Python (NumPy, Matplotlib) and Web standards (HTML5 Canvas/JavaScript, Three.js).
5. Explain mathematical formulas clearly using LaTeX formatting ($...$ and $$...$$).
6. Format your output with clear headings, physical interpretations, and rigorous numerical formulas.`;

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gemini Analysis API
app.post('/api/gemini/analyze', async (req, res) => {
  try {
    const { prompt, simulationState, modelPreference, enableThinking } = req.body;
    const ai = getGeminiClient();

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured in the environment. Please add it to Settings > Secrets.',
      });
    }

    const modelName = modelPreference === 'pro' ? 'gemini-3.1-pro-preview' : 'gemini-3.7-flash';

    const stateContext = simulationState
      ? `\n\n[Current Simulation State]:
- Earth Dipole Moment (m): ${simulationState.earthMoment ?? 1.0}
- Earth Tilt Angle: ${simulationState.earthTilt ?? 0}°
- External Sources (${simulationState.sources?.length || 0}):
${(simulationState.sources || []).map((s: any, idx: number) => `  ${idx + 1}. Type: ${s.type}, Position: (${s.x.toFixed(2)}, ${s.y.toFixed(2)}), Pole Strength/Moment: ${s.strength}`).join('\n')}
- Solar Wind (IMF Bx: ${simulationState.imfBx ?? 0}, Bz: ${simulationState.imfBz ?? 0}, Dynamic Pressure: ${simulationState.solarWindPressure ?? 1.0})
- Peak Crustal Stress: ${(simulationState.maxStress ?? 0).toFixed(4)} GPa (Fault Node: #${simulationState.maxStressNodeIndex ?? 'N/A'})
- Virtual Earthquake State: ${simulationState.earthquakeActive ? 'TRIGGERED (Active seismic slip)' : 'Accumulating Stress'}
- Atmospheric Alignment Order Parameter: ${(simulationState.alignmentOrder ?? 0).toFixed(3)}
`
      : '';

    const fullPrompt = `${prompt}${stateContext}`;

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.7,
    };

    if (enableThinking && modelName.startsWith('gemini-3')) {
      config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: fullPrompt,
      config,
    });

    res.json({
      text: response.text || 'No response generated.',
      model: modelName,
      usage: response.usageMetadata,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze:', error);
    res.status(500).json({
      error: error.message || 'An error occurred during computational physics analysis.',
    });
  }
});

// Gemini Python Code Generation API
app.post('/api/gemini/generate-script', async (req, res) => {
  try {
    const { simulationState, customizationRequest } = req.body;
    const ai = getGeminiClient();

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY is not configured.',
      });
    }

    const prompt = `Write a standalone, complete, production-grade Python script using NumPy, SciPy, and Matplotlib that numerically models and visualizes:
1. Planetary magnetic dipole + external magnetic sources & solar wind IMF with the exact parameters:
   - Earth moment m = ${simulationState?.earthMoment || 1.0}, tilt = ${simulationState?.earthTilt || 0} deg
   - External sources: ${JSON.stringify(simulationState?.sources || [])}
   - Solar Wind IMF: Bx=${simulationState?.imfBx || 0}, Bz=${simulationState?.imfBz || 0}
2. Uses streamplot for magnetic vector field lines with color coding by field magnitude |B_total|.
3. Uses contourf for magnetic energy density / field intensity gradient.
4. Models hypothetical atmospheric particle alignment (linear cloud bands along magnetic flux) and crustal magneto-piezoelectric stress distribution.
5. User specific requests: ${customizationRequest || 'Include high-resolution plots, vector quiver, neutral X-point locator, and mathematical commentary.'}

Output ONLY valid, executable Python code with clear comments.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    res.json({
      code: response.text || '# No code generated',
    });
  } catch (error: any) {
    console.error('Error generating Python script:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate Python script',
    });
  }
});

// Setup Vite middleware or static serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Magnetic Field & Virtual Earthquake Cloud Simulation Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
