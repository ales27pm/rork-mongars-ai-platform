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

const BOS_TOKEN = '<|begin_of_text|>';
const EOS_TOKEN = '<|end_of_text|>';

const safeGetSpecialTokenId = (tokenString: string): number | undefined => {
  try {
    return llama3Tokenizer.getSpecialTokenId(tokenString);
  } catch (error) {
    console.error(`[tokenizer] Failed to resolve special token ${tokenString}`, error);
    return undefined;
  }
};

const BOS_TOKEN_ID = safeGetSpecialTokenId(BOS_TOKEN);
const EOS_TOKEN_ID = safeGetSpecialTokenId(EOS_TOKEN);

const buildTokenizerOptions = (options?: TokenizationOptions) => ({
  bos: options?.addBos ?? DEFAULT_OPTIONS.addBos,
  eos: options?.addEos ?? DEFAULT_OPTIONS.addEos,
});

const stripSpecialTokens = (ids: number[], options?: TokenizationOptions): number[] => {
  const { bos, eos } = buildTokenizerOptions(options);
  let normalizedIds = [...ids];

  if (bos && BOS_TOKEN_ID !== undefined && normalizedIds[0] === BOS_TOKEN_ID) {
    normalizedIds = normalizedIds.slice(1);
  }

  if (eos && EOS_TOKEN_ID !== undefined) {
    const lastIndex = normalizedIds.length - 1;
    if (lastIndex >= 0 && normalizedIds[lastIndex] === EOS_TOKEN_ID) {
      normalizedIds = normalizedIds.slice(0, lastIndex);
    }
  }

  return normalizedIds;
};

export const encodeText = (text: string, options?: TokenizationOptions): TokenizationResult => {
  const tokenizerOptions = buildTokenizerOptions(options);
  const inputIds = llama3Tokenizer.encode(text, tokenizerOptions);

  return {
    inputIds,
    attentionMask: inputIds.map(() => 1),
  };
};

export const decodeTokens = (ids: number[], options?: TokenizationOptions): string => {
  const normalizedIds = stripSpecialTokens(ids, options);
  return llama3Tokenizer.decode(normalizedIds);
};

export const countTokens = (text: string, options?: TokenizationOptions): number => {
  const tokenizerOptions = buildTokenizerOptions(options);
  const inputIds = llama3Tokenizer.encode(text, tokenizerOptions);
  return inputIds.length;
};
