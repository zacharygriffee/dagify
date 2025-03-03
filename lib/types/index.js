import {TypeRegistry} from "./TypeRegistry.js";
import {includeDefaultTypes} from "./defaultTypes.js";

const types = new TypeRegistry();

includeDefaultTypes(types);

export { types };