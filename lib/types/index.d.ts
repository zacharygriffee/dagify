import type { DagifyNode, DagifyTypeChecker } from "../../types/shared";

export type { DagifyTypeChecker, DagifyNode } from "../../types/shared";

export type TypeValidator = (value: unknown) => boolean;

export class TypeRegistry {
  constructor();
  registerType(name: string, validator: TypeValidator): void;
  getType(nameOrValidator: string | TypeValidator): TypeValidator | undefined;
  hasType(name: string): boolean;
  union(...typeNames: string[]): TypeValidator;
  intersection(...typeNames: string[]): TypeValidator;
  createType(name: string, validator: TypeValidator): void;
}

export declare const types: TypeRegistry;

export declare function setType<T = unknown>(
  node: DagifyNode<T>,
  type: DagifyTypeChecker
): DagifyNode<T>;

export declare function getType<T = unknown>(
  node: DagifyNode<T>
): DagifyTypeChecker;
