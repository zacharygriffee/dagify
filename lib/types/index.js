import { TypeRegistry } from "./TypeRegistry.js";
import { includeDefaultTypes } from "./defaultTypes.js";
import {NO_EMIT} from "../node/index.js";

/**
 * Global singleton instance of TypeRegistry used to manage and register all types.
 * @constant {TypeRegistry}
 */
const types = new TypeRegistry();

// Register a universal type 'any' that always validates as true.
types.registerType('any', () => true);

// Include additional default types into the global registry.
includeDefaultTypes(types);

/**
 * Sets the type for a given node.
 * If the provided type is a function, it is executed with the global types registry
 * to determine the type.
 *
 * @param {Object} node - The node object to set the type for.
 * @param {string|Function} type - The type name or a validator function
 * @returns {ReactiveNode} The updated node with the assigned type.
 */
function setType(node, type) {
    node.type = type;
    if (!types.getType(type)?.(node.value)) {
        // Eradicate the invalid value by setting it to NO_EMIT
        node._value = NO_EMIT;
    }
    return node;
}


/**
 * Retrieves the type of a given node.
 * If no type is set on the node, it defaults to the 'any' type from the global types registry.
 *
 * @param {Object} node - The node object from which to retrieve the type.
 * @returns {string|Function} The type of the node, or the default 'any' type if not set.
 */
const getType = (node) => {
    return node.type || types.getType("any");
}

export { types, setType, getType, TypeRegistry };
