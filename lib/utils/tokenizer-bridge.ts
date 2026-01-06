import llama3Tokenizer from 'llama3-tokenizer-js';

export interface TokenizerBridge {
  encode(text: string): number[];
  decode(tokens: number[]): string;
  encodeWithSpecialTokens(text: string): number[];
  decodeWithSpecialTokens(tokens: number[]): string;
  getSpecialTokens(): { bos: number; eos: number; pad?: number };
}

class Llama3TokenizerBridge implements TokenizerBridge {
  private bosToken: number;
  private eosToken: number;

  constructor() {
    this.bosToken = llama3Tokenizer.getSpecialTokenId('<|begin_of_text|>') || 128000;
    this.eosToken = llama3Tokenizer.getSpecialTokenId('<|end_of_text|>') || 128001;
  }

  encode(text: string): number[] {
    return llama3Tokenizer.encode(text, { bos: false, eos: false });
  }

  decode(tokens: number[]): string {
    return llama3Tokenizer.decode(tokens);
  }

  encodeWithSpecialTokens(text: string): number[] {
    return llama3Tokenizer.encode(text, { bos: true, eos: true });
  }

  decodeWithSpecialTokens(tokens: number[]): string {
    const filtered = tokens.filter(t => t !== this.bosToken && t !== this.eosToken);
    return llama3Tokenizer.decode(filtered);
  }

  getSpecialTokens() {
    return {
      bos: this.bosToken,
      eos: this.eosToken,
    };
  }
}

export const tokenizerBridge = new Llama3TokenizerBridge();

export function encodeForModel(text: string, addSpecialTokens = true): number[] {
  if (addSpecialTokens) {
    return tokenizerBridge.encodeWithSpecialTokens(text);
  }
  return tokenizerBridge.encode(text);
}

export function decodeFromModel(tokens: number[], hasSpecialTokens = true): string {
  if (hasSpecialTokens) {
    return tokenizerBridge.decodeWithSpecialTokens(tokens);
  }
  return tokenizerBridge.decode(tokens);
}

export function countTokensInText(text: string): number {
  return tokenizerBridge.encode(text).length;
}

export function preparePromptForLlama3(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: { role: string; content: string }[] = []
): string {
  let prompt = '<|begin_of_text|>';
  
  if (systemPrompt) {
    prompt += '<|start_header_id|>system<|end_header_id|>\n\n';
    prompt += systemPrompt;
    prompt += '<|eot_id|>';
  }
  
  for (const msg of conversationHistory) {
    prompt += `<|start_header_id|>${msg.role}<|end_header_id|>\n\n`;
    prompt += msg.content;
    prompt += '<|eot_id|>';
  }
  
  prompt += '<|start_header_id|>user<|end_header_id|>\n\n';
  prompt += userMessage;
  prompt += '<|eot_id|>';
  prompt += '<|start_header_id|>assistant<|end_header_id|>\n\n';
  
  return prompt;
}

export function extractAssistantResponse(fullOutput: string): string {
  const assistantMatch = fullOutput.match(/<\|start_header_id\|>assistant<\|end_header_id\|>\s*(.*?)(?:<\|eot_id\|>|$)/s);
  return assistantMatch ? assistantMatch[1].trim() : fullOutput.trim();
}
