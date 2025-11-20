const fs = require('fs');
const path = require('path');

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

/**
 * Check if Ollama is available and responding
 *
 * @returns {Promise<boolean>} True if Ollama is healthy
 * @throws {Error} If Ollama is not available or no models are installed
 */
async function checkOllamaHealth() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = await response.json();

    if (!data.models || data.models.length === 0) {
      throw new Error(
        'No Ollama models found.\n' +
        'Install a model with: ollama pull llama3.2'
      );
    }

    // Check if our preferred model is available
    const hasPreferredModel = data.models.some(m => m.name.includes('llama'));

    if (!hasPreferredModel) {
      console.warn(`Preferred model (llama3.2) not found. Available models: ${data.models.map(m => m.name).join(', ')}`);
    }

    return true;

  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch failed')) {
      throw new Error(
        'Ollama not available.\n' +
        'Please start Ollama:\n' +
        '  ollama serve\n' +
        'Or install it:\n' +
        '  brew install ollama'
      );
    }

    throw err;
  }
}

/**
 * Generate meeting notes from transcript using Ollama
 *
 * @param {string} transcriptPath - Path to transcript text file
 * @param {Function} [progressCallback] - Optional callback for progress updates (bytes written)
 * @returns {Promise<string>} Path to generated notes markdown file
 * @throws {Error} If note generation fails
 */
async function generateNotes(transcriptPath, progressCallback) {
  // Verify Ollama is available
  await checkOllamaHealth();

  // Read transcript
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found: ${transcriptPath}`);
  }

  const transcript = fs.readFileSync(transcriptPath, 'utf-8');

  if (transcript.trim().length === 0) {
    throw new Error('Transcript is empty. Cannot generate notes from empty transcript.');
  }

  // Generate output path
  const outputPath = transcriptPath.replace('_transcript.txt', '_notes.md');

  console.log(`Generating notes from transcript: ${transcriptPath}`);
  console.log(`Output will be saved to: ${outputPath}`);

  // Craft prompt for structured note generation
  const prompt = `You create clear and structured meeting notes. Read the transcript and produce well-organised notes with accurate detail and concise wording. Infer the meeting date if it’s mentioned or implied.

Use the following sections when they apply:

Meeting Notes [Include inferred date]
Action Items
Meeting Purpose
Key Takeaways
Topics Discussed
Problem
Blocker
Solution or Proposal
Next Steps

Write in plain UK English. Keep each section brief but complete. Do not invent details that aren’t supported by the transcript.

---

TRANSCRIPT:
${transcript}

---

Generate comprehensive meeting notes following the format above. Extract actual names, specific action items, and technical details from the transcript. If certain sections don't apply (e.g., no blockers discussed), you can omit them. Be concise but thorough.`;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.7,  // Balanced creativity/accuracy
          top_p: 0.9,
          top_k: 40
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (let line of lines) {
        try {
          const json = JSON.parse(line);

          if (json.response) {
            fullResponse += json.response;

            // Call progress callback if provided
            if (progressCallback && !json.done) {
              progressCallback(fullResponse.length);
            }
          }

          if (json.error) {
            throw new Error(`Ollama error: ${json.error}`);
          }

        } catch (parseErr) {
          // Skip invalid JSON lines
          if (!parseErr.message.includes('Unexpected')) {
            console.warn('Failed to parse JSON line:', line);
          }
        }
      }
    }

    // Verify we got a response
    if (fullResponse.trim().length === 0) {
      throw new Error('Ollama returned empty response');
    }

    // Write notes to file
    fs.writeFileSync(outputPath, fullResponse.trim(), 'utf-8');

    console.log(`Notes generated successfully: ${outputPath}`);
    console.log(`Note length: ${fullResponse.length} characters`);

    return outputPath;

  } catch (err) {
    if (err.message.includes('fetch failed') || err.name === 'AbortError') {
      throw new Error('Failed to connect to Ollama. Ensure Ollama is running: ollama serve');
    }

    throw err;
  }
}

/**
 * Get list of available Ollama models
 *
 * @returns {Promise<Array<{name: string, size: number}>>} List of models
 */
async function listModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from Ollama');
    }

    const data = await response.json();
    return data.models || [];

  } catch (err) {
    console.error('Failed to list Ollama models:', err);
    return [];
  }
}

/**
 * Estimate note generation time
 *
 * Based on ~50 tokens/second for llama3.2 on Apple Silicon.
 * Average meeting notes are ~500-1000 tokens.
 *
 * @param {number} transcriptLength - Transcript length in characters
 * @returns {number} Estimated time in milliseconds
 */
function estimateGenerationTime(transcriptLength) {
  // Rough estimate: 4 chars per token, 50 tokens/sec
  const estimatedTokens = Math.ceil(transcriptLength / 4);
  const tokensPerSecond = 50;
  const seconds = Math.ceil(estimatedTokens / tokensPerSecond);

  return seconds * 1000;
}

module.exports = {
  generateNotes,
  checkOllamaHealth,
  listModels,
  estimateGenerationTime,
  OLLAMA_BASE_URL,
  DEFAULT_MODEL
};
