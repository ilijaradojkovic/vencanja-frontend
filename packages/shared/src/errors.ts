import type { MessageKey, MessageParams } from './messages.ts';

/**
 * A business-rule violation raised by the shared rules. The API layer maps it to
 * its HTTP status and the localized `{ message, code, requestId, traceId }`
 * envelope; `code` is always a `packages/shared` message key.
 */
export class RuleViolation extends Error {
  readonly code: MessageKey;
  readonly params: MessageParams;

  constructor(code: MessageKey, params: MessageParams = {}) {
    super(code);
    this.name = 'RuleViolation';
    this.code = code;
    this.params = params;
  }
}

export const isRuleViolation = (error: unknown): error is RuleViolation => error instanceof RuleViolation;
