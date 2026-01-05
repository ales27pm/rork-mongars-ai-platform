import llama3Tokenizer from 'llama3-tokenizer-js';

export interface TokenizationOptions {
  /**
   * Whether to prefix the sequence with the beginning of sequence token.
   * Enabled by default to match Llama 3/3.1 prompt expectations.
   */
  addBos?: boolean;
  /**
   * Whether to suffix the sequence with the end of sequence token.
   * Enabled by default to ensure compatible prompts for instruction models.
   */
  addEos?: boolean;
}

export interface TokenizationResult {
  inputIds: number[];
  attentionMask: number[];
}

const DEFAULT_OPTIONS: Required<TokenizationOptions> = {
  addBos: true,
  addEos: true,
};

const buildTokenizerOptions = (options?: TokenizationOptions) => ({
  bos: options?.addBos ?? DEFAULT_OPTIONS.addBos,
  eos: options?.addEos ?? DEFAULT_OPTIONS.addEos,
});

export const encodeText = (text: string, options?: TokenizationOptions): TokenizationResult => {
  const tokenizerOptions = buildTokenizerOptions(options);
  const inputIds = llama3Tokenizer.encode(text, tokenizerOptions);

  return {
    inputIds,
    attentionMask: inputIds.map(() => 1),
  };
};

export const decodeTokens = (ids: number[], options?: TokenizationOptions): string => {
  const tokenizerOptions = buildTokenizerOptions(options);
  return llama3Tokenizer.decode(ids, tokenizerOptions);
};

export const countTokens = (text: string, options?: TokenizationOptions): number => {
  const { inputIds } = encodeText(text, options);
  return inputIds.length;
};
