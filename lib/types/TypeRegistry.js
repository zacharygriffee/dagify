/**
 * A simple type registry to register and combine type validators.
 */
class TypeRegistry {
    constructor() {
        // A map from type name to a validator function.
        this.types = new Map();
    }

    /**
     * Registers a new type with a given name and a validator function.
     *
     * @param {string} name - Unique name for the type.
     * @param {Function} validator - A function that takes a value and returns true if valid, false otherwise.
     * @throws {Error} If the type is already registered.
     */
    registerType(name, validator) {
        if (this.types.has(name)) {
            throw new Error(`Type "${name}" is already registered.`);
        }
        this.types.set(name, validator);
    }

    /**
     * Retrieves the validator for a registered type.
     *
     * @param {string} name - The name of the registered type.
     * @returns {Function} The validator function.
     */
    getType(name) {
        return this.types.get(name);
    }

    /**
     * Checks whether the type exists.
     *
     * @param {string} name - The name of the registered type.
     * @returns {boolean} Whether the type exists
     */
    hasType(name) {
        return this.types.has(name);
    }

    /**
     * Creates a union type validator.
     * The value is valid if it passes at least one of the provided type validators.
     *
     * @param {...string} typeNames - Type names to combine.
     * @returns {Function} A validator function for the union type.
     */
    union(...typeNames) {
        const validators = typeNames.map(name => {
            const validator = this.getType(name);
            if (!validator) throw new Error(`Type "${name}" is not registered.`);
            return validator;
        });
        return value => validators.some(validator => validator(value));
    }

    /**
     * Creates an intersection type validator.
     * The value is valid if it passes all of the provided type validators.
     *
     * @param {...string} typeNames - Type names to combine.
     * @returns {Function} A validator function for the intersection type.
     */
    intersection(...typeNames) {
        const validators = typeNames.map(name => {
            const validator = this.getType(name);
            if (!validator) throw new Error(`Type "${name}" is not registered.`);
            return validator;
        });
        return value => validators.every(validator => validator(value));
    }

    /**
     * Creates a new type validator based on a combination (union or intersection)
     * of existing types.
     *
     * @param {string} name - The name of the new type.
     * @param {Function} validator - The custom validator function.
     */
    createType(name, validator) {
        this.registerType(name, validator);
    }
}

export {TypeRegistry};