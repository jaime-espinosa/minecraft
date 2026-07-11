import {
  ContractValidationError,
  validateAvatarFrame,
  validateAvatarOperation,
} from '../domain/contracts.js';
import { createDefaultIdentity, createDefaultRecipe } from '../domain/defaults.js';
import { err, ok } from '../domain/result.js';
import { createAppearanceSnapshot, deepFreeze } from './projection.js';

const invalidOperation = (path, message) => err({ kind: 'invalid-operation', path, message });

const cloneAndFreezeFrame = (frame) => deepFreeze(structuredClone(frame));

const contractFault = (kind, error) => err({
  kind,
  path: error.path,
  message: error.message,
});

const readOperations = (operations) => {
  if (!Array.isArray(operations)) {
    throw new ContractValidationError('$.operations', 'must be an array');
  }
  if (operations.length === 0) {
    throw new ContractValidationError('$.operations', 'must contain at least one operation');
  }
  const allowedKeys = new Set(['length']);
  for (let index = 0; index < operations.length; index += 1) allowedKeys.add(String(index));
  for (const key of Reflect.ownKeys(operations)) {
    if (typeof key !== 'string' || !allowedKeys.has(key)) {
      throw new ContractValidationError('$.operations', 'contains an unknown key');
    }
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(operations, key);
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new ContractValidationError(`$.operations[${key}]`, 'must be an enumerable data entry');
    }
  }
  for (let index = 0; index < operations.length; index += 1) {
    if (!Object.hasOwn(operations, index)) {
      throw new ContractValidationError(`$.operations[${index}]`, 'sparse arrays are not supported');
    }
    validateAvatarOperation(operations[index], `$.operations[${index}]`);
  }
  return operations;
};

const readTransactionInput = (input) => {
  if (input === null || typeof input !== 'object' || Array.isArray(input) || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new ContractValidationError('$', 'transaction input must be a plain object');
  }
  const required = ['frame', 'baseRevision', 'operations'];
  const allowed = new Set(required);
  const values = {};
  for (const key of Reflect.ownKeys(input)) {
    const path = `$.${typeof key === 'symbol' ? key.toString() : key}`;
    if (typeof key !== 'string' || !allowed.has(key)) {
      throw new ContractValidationError(path, 'unknown key');
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor.enumerable) {
      throw new ContractValidationError(path, 'non-enumerable own keys are not supported');
    }
    if (!Object.hasOwn(descriptor, 'value')) {
      throw new ContractValidationError(path, 'accessor properties are not supported');
    }
    values[key] = descriptor.value;
  }
  for (const key of required) {
    if (!Object.hasOwn(values, key)) throw new ContractValidationError(`$.${key}`, 'is required');
  }
  return values;
};

const applyPalette = (identity, operation) => {
  const palette = structuredClone(operation.value);
  switch (operation.field) {
    case 'complexion':
      identity.complexionPalette = palette;
      break;
    case 'hair':
      identity.hair.palette = palette;
      break;
    case 'top':
      identity.outfit.top = palette;
      break;
    case 'bottom':
      identity.outfit.bottom = palette;
      break;
    case 'footwear':
      identity.outfit.footwear = palette;
      break;
    default:
      throw new ContractValidationError('$.operations.field', `unsupported value ${JSON.stringify(operation.field)}`);
  }
  identity.provenance[operation.field] = structuredClone(operation.provenance);
};

const applyOperation = (frame, operation) => {
  switch (operation.op) {
    case 'set-palette':
      applyPalette(frame.identity, operation);
      return 'identity';
    case 'set-hair':
      frame.identity.hair.style = operation.value.style;
      frame.identity.hair.volume = operation.value.volume;
      return 'identity';
    case 'set-expression':
      frame.identity.face.expression = operation.value;
      return 'identity';
    case 'set-accessories':
      frame.identity.accessories = structuredClone(operation.value);
      return 'identity';
    case 'set-style':
      frame.recipe.style = structuredClone(operation.value);
      return 'recipe';
    default:
      throw new ContractValidationError('$.operations.op', `unsupported value ${JSON.stringify(operation.op)}`);
  }
};

export function createAvatarKernel() {
  return Object.freeze({
    start(seed) {
      const frame = seed === undefined ? {
        identity: createDefaultIdentity(),
        recipe: createDefaultRecipe(),
      } : seed;
      try {
        validateAvatarFrame(frame);
        return ok(cloneAndFreezeFrame(frame));
      } catch (error) {
        if (error instanceof ContractValidationError) return contractFault('invalid-seed', error);
        return err({ kind: 'invalid-seed', path: '$', message: error.message });
      }
    },

    transact(input) {
      let frame;
      let baseRevision;
      let operations;
      try {
        ({ frame, baseRevision, operations } = readTransactionInput(input));
      } catch (error) {
        if (error instanceof ContractValidationError) return contractFault('invalid-operation', error);
        return invalidOperation('$', error.message);
      }
      try {
        validateAvatarFrame(frame);
      } catch (error) {
        if (error instanceof ContractValidationError) return contractFault('invalid-operation', error);
        return invalidOperation('$.frame', error.message);
      }

      if (!Number.isInteger(baseRevision) || !Number.isFinite(baseRevision)) {
        return invalidOperation('$.baseRevision', 'must be a finite integer');
      }
      if (baseRevision !== frame.recipe.revision) {
        return err({
          kind: 'revision-conflict',
          message: `Expected recipe revision ${frame.recipe.revision} but received ${baseRevision}`,
        });
      }

      try {
        readOperations(operations);
        const next = structuredClone(frame);
        let identityChanged = false;
        let recipeChanged = false;
        for (const operation of operations) {
          const target = applyOperation(next, operation);
          identityChanged ||= target === 'identity';
          recipeChanged ||= target === 'recipe';
        }
        if (identityChanged) {
          next.identity.revision += 1;
          next.recipe.identityRevision = next.identity.revision;
          recipeChanged = true;
        }
        if (recipeChanged) next.recipe.revision += 1;
        validateAvatarFrame(next);
        return ok(deepFreeze(next));
      } catch (error) {
        if (error instanceof ContractValidationError) return contractFault('invalid-operation', error);
        return invalidOperation('$', error.message);
      }
    },

    snapshot(frame) {
      return createAppearanceSnapshot(frame);
    },
  });
}
