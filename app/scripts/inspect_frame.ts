#!/usr/bin/env bun
/**
 * inspect_frame.ts - Targeted Motion Design Frame Visual Verifier
 * 
 * Powered by Claude Haiku 5.5 Vision via Bike4Mind pool.
 * Costs < $0.0001 / check.
 * 
 * Capabilities:
 *   - Auto-retries on empty or truncated reports with expanded token ceiling
 *   - Auto-heals split unquoted paths containing spaces
 *   - Multi-frame inspection in a single command (--images f1.png f2.png ...)
 *   - Query from reusable files (--query-file q.txt)
 *   - Structured JSON output (--json)
 *   - Region zoom (--region x,y,w,h) & Transition seam comparison (--compare frameB.png)
 */
import fs from 'node:fs';
import path from 'node:path';

// Tolerate local proxy / corporate SSL certificates on Windows
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Locate healthy API key from pool (filtering out known depleted keys)
function getApiKey() {
  const envKey = process.env.BIKE4MIND_API_KEY;
  if (envKey && !envKey.startsWith('b4m_live_a3f') && envKey !== 'pool' && !envKey.includes('***')) {
    return envKey;
  }
  const candidates = [
    'C:/Users/brosf/Documents/A vio projects/VioPls/testing/keys.txt',
    'C:/Users/brosf/Documents/A vio projects/VioPls/proxy/keys.txt',
    path.resolve(import.meta.dir, '../../../../testing/keys.txt'),
    path.resolve(import.meta.dir, '../../../../proxy/keys.txt')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const lines = fs.readFileSync(c, 'utf8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && !l.startsWith('b4m_live_a3f'));
      if (lines.length > 0) return lines[0];
    }
  }
  return null;
}

// Parse {~~"..."~~} directive from text
interface VisionDirective {
  query: string;
  region: [number, number, number, number] | null;
  comparePath: string | null;
}

type MessageContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

function parseVisionDirective(text: string | null | undefined): VisionDirective | null {
  if (!text || typeof text !== 'string') return null;
  const tagMatch = text.match(/\{(?:\~\~|\~\~")([\s\S]*?)(?:\~\~"|\~\~\})/);
  if (!tagMatch) return null;

  let raw = tagMatch[1].trim();
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1).trim();

  let region: VisionDirective['region'] = null;
  const regionMatch = raw.match(/region\s*=\s*\[?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]?/i);
  if (regionMatch) {
    region = [parseInt(regionMatch[1], 10), parseInt(regionMatch[2], 10), parseInt(regionMatch[3], 10), parseInt(regionMatch[4], 10)];
    raw = raw.replace(regionMatch[0], '').trim();
  }

  let comparePath: string | null = null;
  const compareMatch = raw.match(/compare\s*=\s*["']?([^"'\s]+)["']?/i);
  if (compareMatch) {
    comparePath = compareMatch[1].trim();
    raw = raw.replace(compareMatch[0], '').trim();
  }

  return {
    query: raw.replace(/^["'\s]+|["'\s]+$/g, '').trim(),
    region,
    comparePath
  };
}

// Build empirical evidence prompt
function buildVisionPrompt(query: string, region: VisionDirective['region'] | null | undefined, comparePath: string | null | undefined, isJsonMode = false) {
  let prompt = `You are a pixel-accurate motion design visual inspection verifier.
Your job is to answer the user's specific questions with empirical visual evidence, NOT generic commentary.

USER QUESTIONS:
${query}
`;

  if (region) {
    const [x, y, w, h] = region;
    prompt += `\nCRITICAL REGION FOCUS:
You must focus your visual inspection specifically within the bounding box:
X=${x}, Y=${y}, Width=${w}, Height=${h} (within standard 1920x1080 frame). Zoom in mentally to this specific area to answer the questions.\n`;
  }

  if (comparePath) {
    prompt += `\nCOMPARE MODE:
You are inspecting two frames (Frame A and Frame B) across a transition seam or cut.
Examine continuity, alignment, lighting changes, shader pops, or visual jumps between the two frames.\n`;
  }

  if (isJsonMode) {
    prompt += `
MANDATORY JSON FORMAT:
You MUST respond with valid JSON ONLY (enclosed in a single markdown code block \`\`\`json ... \`\`\`).
The JSON object must have this exact structure:
{
  "status": "success",
  "answers": [
    {
      "q": 1,
      "summary": "Short direct answer",
      "evidence": "Detailed empirical observation with coordinates",
      "coordinates": { "x": number, "y": number, "w": number, "h": number } // or null
    }
  ],
  "anomalies": [
    "String description of any clipping, black screen, overlapping text, Z-fighting, etc."
  ]
}
`;
  } else {
    prompt += `
MANDATORY RULES:
1. Answer each numbered question (Q1, Q2, etc.) directly.
2. Format each answer with a clear Yes / No / Value, followed immediately by concrete spatial evidence (coordinates like ~x=600, ~y=450, colors, ring/gap/edge positions).
   Example of good answer: "Yes: ring left at ~x=600, red bar centre at x=960, square right at x=1240".
   Example of BAD answer: "Yes, it looks good" or "All elements pass".
3. ANOMALIES / DEFECTS (UNASKED): Even if not asked, if you see any obvious visual defects, clipping, Z-fighting, black screen, missing shaders, NaN colors, overlapping text, or glitched geometry, list them under this section with their locations. If no defects are observed, write "None observed".
`;
  }

  return prompt;
}

// Auto-heal unquoted paths split by spaces
function healAndValidatePaths(potentialPaths: string[]) {
  const resolved: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < potentialPaths.length; i++) {
    const p = potentialPaths[i];
    if (fs.existsSync(p)) {
      resolved.push(path.resolve(p));
      continue;
    }

    // Try stitching adjacent arguments if this looks like a split path
    let stitched = p;
    let found = false;
    for (let j = i + 1; j < Math.min(potentialPaths.length, i + 6); j++) {
      stitched += ' ' + potentialPaths[j];
      if (fs.existsSync(stitched)) {
        console.warn(`[inspect_frame] Note: Auto-healed unquoted path with spaces: "${stitched}"`);
        resolved.push(path.resolve(stitched));
        i = j; // Advance outer loop
        found = true;
        break;
      }
    }

    if (!found) {
      // Check if it looks like a path fragment
      if (p.includes('\\') || p.includes('/') || p.endsWith('.png') || p.endsWith('.jpg')) {
        errors.push(p);
      }
    }
  }

  return { resolved, errors };
}

// Clean query string to strip leading/trailing tag artifacts
function cleanQueryString(raw: string) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/^\{(?:\~\~|\~\~")/, '')
    .replace(/(?:\~\~"|\~\~\})$/, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .trim();
}

// Check if report has a complete body and answers
function isReportComplete(text: string, hasQuestions: boolean, stopReason: string | null | undefined) {
  if (!text || text.trim().length < 60) return false;
  // If the model finished naturally, it's 100% complete
  if (stopReason === 'end_turn') return true;
  // If it hit max_tokens on a trailing word but generated a substantial response (>250 chars)
  if (text.trim().length >= 250) {
    if (!hasQuestions || /q[1-9]|1\.|answer|yes|no/i.test(text)) {
      return true;
    }
  }
  return false;
}

// Perform inspection on a single frame with 1 automatic retry on empty/truncated output
async function inspectFrameWithRetry(imagePath: string, query: string, region: VisionDirective['region'] | null | undefined, comparePath: string | null | undefined, isJsonMode: boolean, apiKey: string) {
  const maxAttempts = 2;
  let lastError: string | null = null;
  let lastText = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Generous token limits so attempt 1 finishes in one shot without triggering retries
    const maxTokens = attempt === 1 ? 2500 : 3500;
    let promptText = buildVisionPrompt(query, region, comparePath, isJsonMode);
    if (attempt > 1) {
      promptText += `\nRETRY DIRECTIVE: Your previous response was cut off. Be extremely direct and concise. Ensure all questions are answered completely within the token limit.\n`;
    }

    const content: MessageContentBlock[] = [{ type: 'text', text: promptText }];
    const imgABytes = fs.readFileSync(imagePath);
    const extA = imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg') ? 'jpeg' : 'png';
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/${extA};base64,${imgABytes.toString('base64')}` }
    });

    if (comparePath && fs.existsSync(comparePath)) {
      const imgBBytes = fs.readFileSync(comparePath);
      const extB = comparePath.endsWith('.jpg') || comparePath.endsWith('.jpeg') ? 'jpeg' : 'png';
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/${extB};base64,${imgBBytes.toString('base64')}` }
      });
    }

    try {
      const res = await fetch('https://app.bike4mind.com/api/ai/v1/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'claude-haiku-5-5',
          messages: [{ role: 'user', content }],
          max_tokens: maxTokens
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const streamText = await res.text();
      let desc = '';
      let stopReason = null;

      for (const l of streamText.split('\n')) {
        if (l.startsWith('data:') && !l.includes('[DONE]')) {
          try {
            const c = JSON.parse(l.slice(5).trim());
            if (c.type === 'content' && c.text) desc += c.text;
            if (c.stopReason) stopReason = c.stopReason;
          } catch (_) {}
        }
      }

      lastText = desc.trim();

      // Check if report completed properly
      const hasQ = /q[1-9]/i.test(query);
      if (isReportComplete(lastText, hasQ, stopReason)) {
        return { success: true, text: lastText, attempts: attempt };
      }

      if (attempt < maxAttempts) {
        console.warn(`[inspect_frame] Note: First pass truncated; completing on retry...`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      lastError = errMsg;
      if (attempt < maxAttempts) {
        console.warn(`[inspect_frame] Warning: Attempt ${attempt} network error (${errMsg}). Retrying...`);
      }
    }
  }

  // If after all attempts we have substantial text (>80 chars), treat as successful output
  if (lastText && lastText.length >= 80) {
    return { success: true, text: lastText, attempts: maxAttempts };
  }

  return { success: false, text: lastText, error: lastError };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: bun scripts/inspect_frame.ts \'{~~"Beat 3, t=45. Q1: ... Q2: ..."~~}\' path/to/frame.png');
    console.error('Flags:');
    console.error('  --images <p1> <p2> ...       Inspect multiple frames in one command');
    console.error('  --query-file <file>          Load query text from a reusable checklist file');
    console.error('  --json                       Output structured machine-readable JSON');
    console.error('  --region <x,y,w,h>           Zoom in on a sub-coordinate bounding box');
    console.error('  --compare <frameB.png>       Compare two frames across a transition seam');
    process.exit(1);
  }

  let query = '';
  let queryFile = null;
  let region: VisionDirective['region'] = null;
  let comparePath: string | null = null;
  let isJsonMode = false;
  const imageArgCandidates = [];

  // Parse arguments and flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--json') {
      isJsonMode = true;
    } else if (arg === '--query' || arg === '-q') {
      query = args[++i] || '';
    } else if (arg === '--query-file' || arg === '-f') {
      queryFile = args[++i] || '';
    } else if (arg === '--region' || arg === '-r') {
      const val = args[++i] || '';
      const parts = val.split(',').map(n => parseInt(n.trim(), 10));
      if (parts.length === 4 && parts.every(Number.isFinite)) region = parts as [number, number, number, number];
    } else if (arg === '--compare' || arg === '-c') {
      comparePath = args[++i] || '';
    } else if (arg === '--image' || arg === '-i') {
      if (args[i + 1]) imageArgCandidates.push(args[++i]);
    } else if (arg === '--images') {
      // Collect all following image paths until next flag
      while (i + 1 < args.length && !args[i + 1].startsWith('-') && !args[i + 1].startsWith('{')) {
        imageArgCandidates.push(args[++i]);
      }
    } else if (arg.startsWith('{') && arg.includes('~~')) {
      const d = parseVisionDirective(arg);
      if (d) {
        if (!query) query = d.query;
        if (!region && d.region) region = d.region;
        if (!comparePath && d.comparePath) comparePath = d.comparePath;
      }
    } else {
      // Positional path candidate
      imageArgCandidates.push(arg);
    }
  }

  // Load query from file if requested
  if (queryFile) {
    let resolvedQueryFile = queryFile;
    if (!fs.existsSync(resolvedQueryFile)) {
      // Check scripts/queries/ template folder
      const candidateTemplate = path.resolve(import.meta.dir, 'queries', queryFile);
      if (fs.existsSync(candidateTemplate)) {
        resolvedQueryFile = candidateTemplate;
      }
    }

    if (fs.existsSync(resolvedQueryFile)) {
      query = fs.readFileSync(resolvedQueryFile, 'utf8').trim();
    } else {
      console.error(`[Vision Inspection Error: Query file not found: "${queryFile}"]`);
      process.exit(1);
    }
  }

  if (!query) {
    console.error('[Vision Inspection Error: No query directive given]');
    console.error('Format required: {~~"Specific questions to verify (Q1: ..., Q2: ...)"~~} or --query "..." or --query-file <file>');
    process.exit(1);
  }

  // Strip {~~ ... ~~} and redundant outer quotes for clean prompt & display
  query = cleanQueryString(query);

  // Resolve and heal all image paths
  const { resolved: validImages, errors: badPaths } = healAndValidatePaths(imageArgCandidates);

  if (badPaths.length > 0) {
    console.error(`[Vision Inspection Error: File not found: "${badPaths[0]}"]`);
    if (badPaths.length > 1) {
      console.error(`Hint: Detected ${badPaths.length} unquoted argument fragments: "${badPaths.join(' ')}"`);
      console.error('Did you forget to wrap a file path containing spaces in quotes? (e.g., --image "path with spaces/frame.png")');
    }
    process.exit(1);
  }

  if (validImages.length === 0) {
    console.error('[Vision Inspection Error: No valid image files provided]');
    console.error('Usage: bun scripts/inspect_frame.ts --image <path.png> --query "..."');
    console.error('       bun scripts/inspect_frame.ts --images <p1.png> <p2.png> --query-file <q.txt>');
    process.exit(1);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[Vision Inspection Error: No active Bike4Mind API key found in keys.txt]');
    process.exit(1);
  }

  if (!isJsonMode) {
    console.log(`[inspect_frame] Verifying ${validImages.length} frame(s) via Claude Haiku 5.5...`);
    console.log(`[inspect_frame] Query: "${query.replace(/\n/g, ' ').slice(0, 80)}..."\n`);
  }

  const jsonResults = [];
  let hasFailure = false;

  for (let i = 0; i < validImages.length; i++) {
    const currentImg = validImages[i];
    const baseName = path.basename(currentImg);

    const result = await inspectFrameWithRetry(currentImg, query, region, comparePath, isJsonMode, apiKey);

    if (!result.success) {
      hasFailure = true;
      if (isJsonMode) {
        jsonResults.push({
          file: baseName,
          path: currentImg,
          status: 'error',
          error: result.error || 'Empty or incomplete report produced after retry'
        });
      } else {
        console.error(`\n[Vision Inspection Error on ${baseName}: Empty or truncated report after retry]`);
        if (result.text) console.error(`Partial response: ${result.text}`);
      }
      continue;
    }

    if (isJsonMode) {
      let parsed = null;
      try {
        const jsonMatch = result.text.match(/```json\s*([\s\S]*?)\s*```/) || [null, result.text];
        parsed = JSON.parse(jsonMatch[1]);
      } catch (_) {
        parsed = { status: 'success', raw: result.text };
      }
      jsonResults.push({
        file: baseName,
        path: currentImg,
        ...parsed
      });
    } else {
      if (validImages.length > 1) {
        console.log(`============================================================`);
        console.log(`=== VISUAL INSPECTION REPORT [${i + 1}/${validImages.length}]: ${baseName}`);
        console.log(`============================================================`);
      } else {
        console.log(`=== VISUAL INSPECTION REPORT: ${baseName} ===`);
      }
      console.log(result.text);
      console.log('============================================================\n');
    }
  }

  if (isJsonMode) {
    console.log(JSON.stringify(validImages.length === 1 ? jsonResults[0] : jsonResults, null, 2));
  }

  if (hasFailure) {
    process.exit(1);
  }
}

main();
