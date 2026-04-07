import { pipeline } from '@xenova/transformers';

const SENTIMENT_MODEL = 'Xenova/nlptown/bert-base-multilingual-uncased-sentiment';
const EMBEDDING_MODEL = 'Xenova/bert-base-uncased';

const STOPWORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'did',
  'do',
  'does',
  'doing',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'with',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
]);

let sentimentPipelinePromise = null;
let embeddingPipelinePromise = null;

function getSentimentPipeline() {
  if (!sentimentPipelinePromise) {
    sentimentPipelinePromise = pipeline('text-classification', SENTIMENT_MODEL);
  }
  return sentimentPipelinePromise;
}

function getEmbeddingPipeline() {
  if (!embeddingPipelinePromise) {
    embeddingPipelinePromise = pipeline('feature-extraction', EMBEDDING_MODEL);
  }
  return embeddingPipelinePromise;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function buildKeywordCandidates(text) {
  const words = tokenize(text);
  if (!words.length) return [];

  const frequency = new Map();

  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  for (let i = 0; i < words.length - 1; i += 1) {
    const first = words[i];
    const second = words[i + 1];
    if (!first || !second) continue;
    const phrase = `${first} ${second}`;
    frequency.set(phrase, (frequency.get(phrase) || 0) + 1.25);
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([term, score]) => ({ term, score }));
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parseEmbeddingRows(tensor) {
  const data = Array.from(tensor?.data || []);
  const dims = Array.isArray(tensor?.dims) ? tensor.dims : [];

  if (!data.length || dims.length < 2) {
    return [];
  }

  const rows = Number(dims[0]) || 0;
  const cols = Number(dims[1]) || 0;

  if (!rows || !cols) {
    return [];
  }

  const vectors = [];
  for (let r = 0; r < rows; r += 1) {
    const start = r * cols;
    vectors.push(data.slice(start, start + cols));
  }
  return vectors;
}

async function extractKeywordsWithBert(text, maxKeywords = 6) {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  const candidates = buildKeywordCandidates(normalized);
  if (!candidates.length) return [];

  const extractor = await getEmbeddingPipeline();
  const inputs = [normalized, ...candidates.map((candidate) => candidate.term)];
  const embedding = await extractor(inputs, { pooling: 'mean', normalize: true });
  const rows = parseEmbeddingRows(embedding);

  if (rows.length !== inputs.length) {
    return candidates.slice(0, maxKeywords).map((item) => item.term);
  }

  const documentVector = rows[0];
  const maxFrequency = Math.max(...candidates.map((candidate) => candidate.score), 1);

  const ranked = candidates
    .map((candidate, index) => {
      const similarity = cosineSimilarity(documentVector, rows[index + 1]);
      const frequencyWeight = (candidate.score || 0) / maxFrequency;
      const score = similarity * 0.72 + frequencyWeight * 0.28;
      return {
        term: candidate.term,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKeywords)
    .map((item) => item.term);

  return Array.from(new Set(ranked));
}

function mapStarToEmotion(stars) {
  if (stars <= 1) return 'CRITICAL';
  if (stars === 2) return 'BAD';
  if (stars === 3) return 'NEUTRAL';
  if (stars === 4) return 'GOOD';
  return 'HAPPY';
}

async function extractEmotionWithBert(text) {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return {
      emotion: 'NEUTRAL',
      score: 0,
      label: 'neutral',
    };
  }

  const classifier = await getSentimentPipeline();
  const output = await classifier(normalized, { topk: 5 });

  const rows = Array.isArray(output) && Array.isArray(output[0]) ? output[0] : output;
  const best = Array.isArray(rows) && rows.length ? rows[0] : null;

  const rawLabel = String(best?.label || '').trim();
  const score = Number(best?.score) || 0;
  const starsMatch = rawLabel.match(/([1-5])/);
  const stars = starsMatch ? Number(starsMatch[1]) : 3;

  return {
    emotion: mapStarToEmotion(stars),
    score,
    label: rawLabel || `${stars} stars`,
  };
}

export async function extractKeywordsAndEmotion(text, options = {}) {
  const maxKeywords = Math.max(3, Math.min(Number(options?.maxKeywords || 6), 8));

  const [keywords, emotionResult] = await Promise.all([
    extractKeywordsWithBert(text, maxKeywords),
    extractEmotionWithBert(text),
  ]);

  return {
    keywords,
    emotion: emotionResult.emotion,
    emotionLabel: emotionResult.label,
    emotionScore: emotionResult.score,
  };
}
