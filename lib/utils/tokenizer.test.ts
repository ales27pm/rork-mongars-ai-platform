import { countTokens, decodeTokens, encodeText } from './tokenizer';

describe('tokenizer utilities', () => {
  it('encodes text with attention mask aligned to token ids', () => {
    const sample = 'Hello world!';
    const result = encodeText(sample);

    expect(result.inputIds.length).toBeGreaterThan(0);
    expect(result.attentionMask).toHaveLength(result.inputIds.length);
  });

  it('round trips unicode content when special tokens are disabled', () => {
    const sample = 'Multilingual 🌍 text — こんにちは世界';
    const options = { addBos: false, addEos: false };
    const { inputIds } = encodeText(sample, options);
    const decoded = decodeTokens(inputIds, options);

    expect(decoded).toBe(sample);
  });

  it('counts tokens consistently with encoder', () => {
    const sample = 'Token count validation';
    const tokens = countTokens(sample);
    const { inputIds } = encodeText(sample);

    expect(tokens).toBe(inputIds.length);
  });
});
