import type {
  CommandNode,
  CommandNodeOptions,
} from "../../types/shared";

export type { CommandNode, CommandNodeOptions } from "../../types/shared";

export declare function createCommandNode<TInput = unknown, TResult = unknown>(
  commandName: string,
  handler: (payload: TInput) => TResult | Promise<TResult>,
  config?: CommandNodeOptions<TInput, TResult>,
  context?: string
): CommandNode<TInput, TResult>;
