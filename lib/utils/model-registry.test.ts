import { ModelRegistry, MODEL_REGISTRY } from './model-registry';
import { countTokens } from './tokenizer';

describe('ModelRegistry tokenizer configuration', () => {
  it('assigns the llama tokenizer to dolphin models', () => {
    const llamaModel = MODEL_REGISTRY.find(model => model.id === 'dolphin-llama-3.2-3b-4bit');

    expect(llamaModel?.tokenizer?.countTokens?.('hello world')).toBe(countTokens('hello world'));
  });

  it('provides a heuristic tokenizer for cloud models when a specialized one is unavailable', () => {
    const registry = new ModelRegistry();
    const cloudModel = registry.getCloudModels().find(model => model.id === 'gpt-4o-mini');

    const expectedHeuristicCount = Math.max(Math.ceil('sample prompt'.length / 3), 1);
    expect(cloudModel?.tokenizer?.countTokens?.('sample prompt')).toBe(expectedHeuristicCount);
  });
});
