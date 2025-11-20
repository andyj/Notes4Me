#!/usr/bin/env node

/**
 * Standalone script for testing summary generation
 * Usage: npm run summaryonly <transcript-file-path>
 *
 * Outputs the generated summary to console instead of saving to file.
 * Useful for quickly tweaking the AI prompt.
 */

const fs = require('fs');
const path = require('path');

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

/**
 * Check if Ollama is available
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
      throw new Error('No Ollama models found. Install with: ollama pull llama3.2');
    }

    return true;

  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('fetch failed')) {
      throw new Error('Ollama not available. Please start: ollama serve');
    }
    throw err;
  }
}

/**
 * Generate summary and output to console
 */
async function generateSummary(transcriptPath) {
  // Verify Ollama is available
  console.log('Checking Ollama health...');
  await checkOllamaHealth();
  console.log('✓ Ollama is running\n');

  // Read transcript
  if (!fs.existsSync(transcriptPath)) {
    throw new Error(`Transcript file not found: ${transcriptPath}`);
  }

  const transcript = fs.readFileSync(transcriptPath, 'utf-8');

  if (transcript.trim().length === 0) {
    throw new Error('Transcript is empty.');
  }

  console.log(`Reading transcript: ${transcriptPath}`);
  console.log(`Transcript length: ${transcript.length} characters\n`);

  // Craft prompt for structured note generation
  const prompt = `You create clear and structured meeting notes. Read the transcript and produce well-organised notes with accurate detail and concise wording. Infer the meeting date if it's mentioned or implied.

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

Write in plain UK English. Keep each section brief but complete. Do not invent details that aren't supported by the transcript.

---

TRANSCRIPT:
${transcript}

---

Generate comprehensive meeting notes following the format above. Extract actual names, specific action items, and technical details from the transcript. If certain sections don't apply (e.g., no blockers discussed), you can omit them. Be concise but thorough.`;

  console.log('Generating summary with Ollama...\n');
  console.log('='.repeat(80));
  console.log();

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: prompt,
        stream: true,
        options: {
          temperature: 0.7,
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

    // Stream response to console in real-time
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (let line of lines) {
        try {
          const json = JSON.parse(line);

          if (json.response) {
            process.stdout.write(json.response);
            fullResponse += json.response;
          }

          if (json.error) {
            throw new Error(`Ollama error: ${json.error}`);
          }

        } catch (parseErr) {
          // Skip invalid JSON lines
          if (!parseErr.message.includes('Unexpected')) {
            console.warn('\nFailed to parse JSON line:', line);
          }
        }
      }
    }

    // Verify we got a response
    if (fullResponse.trim().length === 0) {
      throw new Error('Ollama returned empty response');
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log(`\n✓ Summary generated (${fullResponse.length} characters)`);

  } catch (err) {
    if (err.message.includes('fetch failed') || err.name === 'AbortError') {
      throw new Error('Failed to connect to Ollama. Ensure Ollama is running: ollama serve');
    }
    throw err;
  }
}

// Main execution
async function main() {
  const transcriptPath = process.argv[2];

  if (!transcriptPath) {
    console.error('Usage: npm run summaryonly <transcript-file-path>');
    console.error('\nExample:');
    console.error('  npm run summaryonly /Users/andyjarrett/Documents/MeetingRecordings/processed/2025-11-20_15-50-22_recording_transcript.txt');
    process.exit(1);
  }

  try {
    await generateSummary(transcriptPath);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
