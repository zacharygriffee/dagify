import {TypeRegistry} from "./TypeRegistry.js";
import {includeDefaultTypes} from "./basicTypes.js";

const types = new TypeRegistry();

includeDefaultTypes(types);

export { types };