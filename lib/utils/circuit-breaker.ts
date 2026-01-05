export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitorWindow?: number;
  onStateChange?: (state: CircuitState) => void;
  onFailure?: (error: Error) => void;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttempt = 0;
  private config: Required<CircuitBreakerConfig>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000,
      resetTimeout: config.resetTimeout || 30000,
      monitorWindow: config.monitorWindow || 10,
      onStateChange: config.onStateChange || (() => {}),
      onFailure: config.onFailure || (() => {}),
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.transitionTo(CircuitState.HALF_OPEN);
    }

    this.totalRequests++;

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), this.config.timeout)
      ),
    ]);
  }

  private onSuccess() {
    this.lastSuccessTime = Date.now();
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.successes = 0;
      }
    }
  }

  private onFailure(error: Error) {
    this.lastFailureTime = Date.now();
    this.failures++;
    this.successes = 0;

    this.config.onFailure(error);

    if (this.failures >= this.config.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
      this.nextAttempt = Date.now() + this.config.resetTimeout;
    }
  }

  private transitionTo(newState: CircuitState) {
    if (this.state !== newState) {
      console.log(`[CircuitBreaker] State transition: ${this.state} -> ${newState}`);
      this.state = newState;
      this.config.onStateChange(newState);
    }
  }

  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  reset() {
    console.log('[CircuitBreaker] Manual reset');
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttempt = 0;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  getHealthScore(): number {
    if (this.totalRequests === 0) return 1.0;
    
    const successRate = 1 - (this.failures / this.totalRequests);
    const stateScore = this.state === CircuitState.CLOSED ? 1.0 : 
                       this.state === CircuitState.HALF_OPEN ? 0.5 : 0.0;
    
    return (successRate + stateScore) / 2;
  }
}

export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}
