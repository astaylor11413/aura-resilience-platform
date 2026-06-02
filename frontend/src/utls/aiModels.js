import { pipeline } from '@xenova/transformers';

// Lazy-load singleton instances
let pipelines = {};

export async function getModel(type) {
  if (pipelines[type]) return pipelines[type];
  
  // Note: Transformers.js automatically downloads models to browser cache
  if (type === 'triage') {
    pipelines.triage = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
  }
  return pipelines[type];
}