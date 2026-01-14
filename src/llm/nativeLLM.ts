import { requireNativeModule } from 'native-llm';

// Wrapper for the native module
const nativeLLM = requireNativeModule('native-llm');

type LlmEventPayload = {
    type: 'token' | 'done' | 'error' | 'status';
    data: unknown;
};

export class NativeLLMClient {
    private listeners: { [key: string]: Function[] } = {};

    constructor() {
        // Initialize listeners or other configs if necessary
    }

    on(event: LlmEventPayload['type'], listener: Function) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    off(event: LlmEventPayload['type'], listener: Function) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((l) => l !== listener);
    }

    emit(event: LlmEventPayload['type'], data: any) {
        if (this.listeners[event]) {
            this.listeners[event].forEach((listener) => listener(data));
        }
    }

    async loadModel(modelPath: string) {
        try {
            const result = await nativeLLM.loadModel(modelPath);
            this.emit('status', 'Model Loaded: ' + result);
        } catch (error) {
            this.emit('error', error);
        }
    }

    async generate(prompt: string) {
        try {
            const tokenStream = nativeLLM.generate(prompt);
            for await (const token of tokenStream) {
                this.emit('token', token);
            }
            this.emit('done', null);
        } catch (error) {
            this.emit('error', error);
        }
    }

    stop() {
        try {
            nativeLLM.stop?.();
            this.emit('status', 'Generation stopped');
        } catch (error) {
            this.emit('error', error);
        }
    }
}

// CLI/Demo interface
(async () => {
    const client = new NativeLLMClient();

    client.on('status', (data) => console.log('STATUS:', data));
    client.on('token', (data) => console.log('TOKEN:', data));
    client.on('done', () => console.log('GENERATION DONE'));
    client.on('error', (err) => console.error('ERROR:', err));

    console.log('Loading model...');
    await client.loadModel('path/to/model');

    console.log('Generating text...');
    client.generate('Hello, world!');

    setTimeout(() => {
        console.log('Stopping generation...');
        client.stop();
    }, 5000);
})();