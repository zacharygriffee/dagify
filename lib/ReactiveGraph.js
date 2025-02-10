import b4a from "b4a";
import BufferMap from "tiny-buffer-map";
import cenc from "compact-encoding";

/**
 * Represents a reactive dependency graph for dagify nodes.
 *
 * Each node is stored using a Buffer key, and edges (dependencies) are managed as a mapping
 * from source node Buffer keys to Sets of target node Buffer keys.
 *
 * @example
 * const graph = new ReactiveGraph({ keyEncoding: "utf8" });
 * graph.addNode({ id: "a", isDagifyNode: true, fn: () => {} });
 * graph.addNode({ id: "b", isDagifyNode: true, fn: () => {} });
 * graph.connect("a", "b");
 */
class ReactiveGraph {
    /**
     * Creates an instance of ReactiveGraph.
     *
     * @param {Object} [config={}] - Optional configuration object.
     * @param {string} [config.keyEncoding="binary"] - The encoding to use for node keys.
     */
    constructor(config = {}) {
        const { keyEncoding = "binary" } = config;
        this.keyEncoding = cenc.from(keyEncoding);
        // Both nodes and edges use Buffer keys.
        this.nodes = new BufferMap(); // Map<Buffer, node>
        this.edges = new BufferMap(); // Map<Buffer, Set<Buffer>>
    }

    /**
     * Decodes a given key using the configured key encoding.
     *
     * @param {Buffer|string} key - The key to decode.
     * @returns {*} The decoded key.
     */
    decodeKey(key) {
        return cenc.decode(this.keyEncoding, key);
    }

    /**
     * Encodes a given key using the configured key encoding.
     *
     * @param {*} key - The key to encode. If the key is already a Buffer, it is returned as is.
     * @returns {Buffer} The encoded key.
     */
    encodeKey(key) {
        if (b4a.isBuffer(key)) return key;
        return cenc.encode(this.keyEncoding, key);
    }

    /**
     * Resolves a node reference into a Buffer key.
     *
     * The reference can be one of the following:
     * - A string, which will be encoded.
     * - A Buffer, which will be returned directly.
     * - A dagify node object with an `id` property and `isDagifyNode` set to true.
     *
     * @private
     * @param {string|Buffer|Object} ref - A string, Buffer, or dagify node object.
     * @returns {Buffer} The resolved Buffer key.
     * @throws {Error} If the dagify node is missing an `id` property or the reference is invalid.
     */
    _resolveId(ref) {
        if (typeof ref === "string") {
            return cenc.encode(this.keyEncoding, ref);
        }
        if (b4a.isBuffer(ref)) {
            return ref;
        }
        if (ref && typeof ref === "object" && ref.isDagifyNode === true) {
            if (!ref.id) {
                throw new Error("Dagify node missing id property.");
            }
            return cenc.encode(this.keyEncoding, ref.id);
        }
        throw new Error(
            "Invalid node reference: must be a string, buffer, or dagify node object."
        );
    }

    /**
     * Adds a node to the graph.
     *
     * The node can be added in two ways:
     * 1. By passing a single dagify node object (which must have `isDagifyNode === true` and an `id` property).
     * 2. By passing an identifier (string or Buffer) as the first argument and the dagify node as the second argument.
     *
     * @param {string|Buffer|Object} nodeOrId - Either a dagify node object or an identifier for the node.
     * @param {Object} [maybeNode] - The dagify node object if an identifier is provided as the first argument.
     * @throws {Error} If the node is invalid or a node with the same key already exists.
     */
    addNode(nodeOrId, maybeNode) {
        let id, node;
        if (maybeNode === undefined) {
            if (!nodeOrId || nodeOrId.isDagifyNode !== true) {
                throw new Error(
                    "Invalid node: expected a dagify node object with isDagifyNode===true."
                );
            }
            node = nodeOrId;
            id = this._resolveId(node);
        } else {
            id = this._resolveId(nodeOrId);
            node = maybeNode;
            if (!node.isDagifyNode) {
                throw new Error("Provided node does not have isDagifyNode===true.");
            }
        }
        if (this.nodes.has(id)) {
            throw new Error(`Node '${this.decodeKey(id)}' already exists.`);
        }
        this.nodes.set(id, node);
        this.edges.set(id, new Set());
    }

    /**
     * Removes a node and all its connections from the graph.
     *
     * This method removes both outgoing edges from the node and incoming edges to the node.
     *
     * @param {string|Buffer|Object} nodeRef - The node reference to remove.
     * @throws {Error} If the node does not exist.
     */
    removeNode(nodeRef) {
        const id = this._resolveId(nodeRef);
        if (!this.nodes.has(id)) {
            throw new Error(`Node '${this.decodeKey(id)}' does not exist.`);
        }

        // Remove outgoing edges.
        for (const tgtId of this.edges.get(id)) {
            const tgtNode = this.nodes.get(tgtId);
            const srcNode = this.nodes.get(id);
            if (tgtNode && tgtNode.fn) {
                tgtNode.removeDependency(srcNode);
            }
        }
        this.edges.delete(id);

        // Remove incoming edges.
        for (const [srcId, targets] of this.edges) {
            for (const tgt of targets) {
                if (b4a.equals(tgt, id)) {
                    targets.delete(tgt);
                    const srcNode = this.nodes.get(srcId);
                    const tgtNode = this.nodes.get(id);
                    if (tgtNode && tgtNode.fn) {
                        tgtNode.removeDependency(srcNode);
                    }
                    break;
                }
            }
        }

        this.nodes.delete(id);
    }

    /**
     * Connects two nodes by adding an edge from the source to the target.
     *
     * If the target node has a computation function (`fn`), the source node is added as a dependency.
     *
     * @param {string|Buffer|Object} srcRef - The source node reference.
     * @param {string|Buffer|Object} tgtRef - The target node reference.
     * @throws {Error} If either node does not exist or if the new connection would create a cycle.
     */
    connect(srcRef, tgtRef) {
        const srcId = this._resolveId(srcRef);
        const tgtId = this._resolveId(tgtRef);

        if (!this.nodes.has(srcId) || !this.nodes.has(tgtId)) {
            throw new Error(
                `Invalid node references '${this.decodeKey(srcId)}', '${this.decodeKey(tgtId)}'.`
            );
        }

        if (this.createsCycle(srcId, tgtId)) {
            throw new Error(
                `Connecting ${this.decodeKey(srcId)} -> ${this.decodeKey(tgtId)} would create a cycle.`
            );
        }

        this.edges.get(srcId).add(tgtId);

        const tgtNode = this.nodes.get(tgtId);
        const srcNode = this.nodes.get(srcId);
        if (tgtNode.fn) {
            tgtNode.addDependency(srcNode);
        }
    }

    /**
     * Disconnects two nodes by removing the edge from the source to the target.
     *
     * If the target node has a computation function (`fn`), the source node is removed from its dependencies.
     *
     * @param {string|Buffer|Object} srcRef - The source node reference.
     * @param {string|Buffer|Object} tgtRef - The target node reference.
     * @throws {Error} If either node does not exist or if no edge exists between the given nodes.
     */
    disconnect(srcRef, tgtRef) {
        const srcId = this._resolveId(srcRef);
        const tgtId = this._resolveId(tgtRef);

        if (!this.nodes.has(srcId) || !this.nodes.has(tgtId)) {
            throw new Error(
                `Invalid node references '${this.decodeKey(srcId)}', '${this.decodeKey(tgtId)}'.`
            );
        }
        const targets = this.edges.get(srcId);
        let found = false;
        for (const key of targets) {
            if (b4a.equals(key, tgtId)) {
                targets.delete(key);
                found = true;
                break;
            }
        }
        if (!found) {
            throw new Error(
                `No edge exists from '${this.decodeKey(srcId)}' to '${this.decodeKey(tgtId)}'.`
            );
        }

        const tgtNode = this.nodes.get(tgtId);
        const srcNode = this.nodes.get(srcId);
        if (tgtNode.fn) {
            tgtNode.removeDependency(srcNode);
        }
    }

    /**
     * Checks whether connecting the source node to the target node would create a cycle.
     *
     * This is done by performing a depth-first search starting at the target node and checking if the source node is reachable.
     *
     * @param {Buffer} srcId - The Buffer key of the source node.
     * @param {Buffer} tgtId - The Buffer key of the target node.
     * @returns {boolean} True if connecting the nodes would create a cycle, false otherwise.
     */
    createsCycle(srcId, tgtId) {
        const visited = new Set();
        const stack = [tgtId];

        while (stack.length > 0) {
            const current = stack.pop();
            if (b4a.equals(current, srcId)) return true;
            // Use hex representation in visited set.
            const currentHex = current.toString("hex");
            if (!visited.has(currentHex)) {
                visited.add(currentHex);
                const neighbors = this.edges.get(current) || new Set();
                for (const neighbor of neighbors) {
                    stack.push(neighbor);
                }
            }
        }
        return false;
    }

    /**
     * Returns an array of node Buffer keys sorted in topological order.
     *
     * Nodes with no incoming edges come first. If the graph contains a cycle, an error is thrown.
     *
     * @returns {Buffer[]} An array of Buffer keys sorted topologically.
     * @throws {Error} If the graph contains at least one cycle.
     */
    topologicalSort() {
        // Build inDegree using BufferMap.
        const inDegree = new BufferMap();
        for (const id of this.nodes.keys()) {
            inDegree.set(id, 0);
        }
        for (const [src, targets] of this.edges) {
            for (const tgt of targets) {
                inDegree.set(tgt, inDegree.get(tgt) + 1);
            }
        }

        const queue = [];
        for (const [id, degree] of inDegree) {
            if (degree === 0) {
                queue.push(id);
            }
        }

        const sorted = [];
        while (queue.length) {
            const id = queue.shift();
            sorted.push(id);
            const targets = this.edges.get(id) || new Set();
            for (const neighbor of targets) {
                inDegree.set(neighbor, inDegree.get(neighbor) - 1);
                if (inDegree.get(neighbor) === 0) {
                    queue.push(neighbor);
                }
            }
        }

        if (sorted.length !== this.nodes.size) {
            throw new Error("Graph has at least one cycle.");
        }
        return sorted;
    }

    /**
     * Calls the `update()` method on all computed nodes in the graph.
     *
     * Nodes are updated in topological order to ensure that dependencies are updated before their dependents.
     */
    update() {
        const sortedIds = this.topologicalSort();
        for (const id of sortedIds) {
            const node = this.nodes.get(id);
            if (node.fn) {
                node.update();
            }
        }
    }

    /* ===============================================================
       Additional Utility Methods for Predecessors, Successors, Node Retrieval,
       and Graph Introspection/Manipulation.
       =============================================================== */

    /**
     * Retrieves a node (or nodes) from the graph.
     *
     * If given a single reference (string, Buffer, or dagify node object),
     * returns the corresponding node. If given an array of references,
     * returns an array of nodes.
     *
     * @param {string|Buffer|Object|Array} refOrRefs - A node reference or an array of node references.
     * @returns {Object|Array} The corresponding node or array of nodes.
     * @throws {Error} If any node does not exist.
     */
    getNode(refOrRefs) {
        if (Array.isArray(refOrRefs)) {
            return refOrRefs.map((ref) => this._getNode(ref));
        }
        return this._getNode(refOrRefs);
    }

    /**
     * Retrieves a single node given a reference.
     *
     * @private
     * @param {string|Buffer|Object} ref - A node reference.
     * @returns {Object} The corresponding node.
     * @throws {Error} If the node does not exist.
     */
    _getNode(ref) {
        const id = this._resolveId(ref);
        if (!this.nodes.has(id)) {
            throw new Error(`Node '${this.decodeKey(id)}' does not exist.`);
        }
        return this.nodes.get(id);
    }

    /**
     * Returns the immediate predecessor nodes (i.e. direct sources) of the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {Array} An array of immediate predecessor nodes.
     */
    getImmediatePredecessors(ref) {
        const id = this._resolveId(ref);
        const predecessors = [];
        for (const [srcId, targets] of this.edges) {
            for (const target of targets) {
                if (b4a.equals(target, id)) {
                    predecessors.push(this.nodes.get(srcId));
                    break; // found a matching edge for this source; move to the next
                }
            }
        }
        return predecessors;
    }

    /**
     * Returns the predecessor nodes of the given node.
     *
     * If {@code options.transitive} is true, returns all transitive predecessors (i.e., all nodes
     * that can reach the given node). Otherwise, returns only the immediate predecessors.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @param {Object} [options] - Options.
     * @param {boolean} [options.transitive=false] - Whether to return transitive predecessors.
     * @returns {Array} An array of predecessor nodes.
     */
    getPredecessors(ref, options = { transitive: false }) {
        if (!options.transitive) return this.getImmediatePredecessors(ref);
        const startId = this._resolveId(ref);
        const visited = new Set();
        const result = new Set();
        const stack = [startId];
        while (stack.length > 0) {
            const currentId = stack.pop();
            for (const [srcId, targets] of this.edges) {
                // Instead of targets.has(currentId), iterate with proper Buffer comparison.
                for (const target of targets) {
                    if (b4a.equals(target, currentId)) {
                        const srcHex = srcId.toString("hex");
                        if (!visited.has(srcHex)) {
                            visited.add(srcHex);
                            result.add(this.nodes.get(srcId));
                            stack.push(srcId);
                        }
                        break;
                    }
                }
            }
        }
        return Array.from(result);
    }

    /**
     * Returns the immediate successor nodes (i.e. direct dependents) of the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {Array} An array of immediate successor nodes.
     */
    getImmediateSuccessors(ref) {
        const id = this._resolveId(ref);
        const successors = [];
        const targets = this.edges.get(id) || new Set();
        for (const tgtId of targets) {
            successors.push(this.nodes.get(tgtId));
        }
        return successors;
    }

    /**
     * Returns the successor nodes of the given node.
     *
     * If {@code options.transitive} is true, returns all transitive successors (i.e. all nodes reachable
     * from the given node). Otherwise, returns only the immediate successors.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @param {Object} [options] - Options.
     * @param {boolean} [options.transitive=false] - Whether to return transitive successors.
     * @returns {Array} An array of successor nodes.
     */
    getSuccessors(ref, options = { transitive: false }) {
        if (!options.transitive) return this.getImmediateSuccessors(ref);
        const startId = this._resolveId(ref);
        const visited = new Set();
        const result = new Set();
        const stack = [startId];
        while (stack.length > 0) {
            const currentId = stack.pop();
            const targets = this.edges.get(currentId) || new Set();
            for (const tgtId of targets) {
                const key = tgtId.toString("hex");
                if (!visited.has(key)) {
                    visited.add(key);
                    result.add(this.nodes.get(tgtId));
                    stack.push(tgtId);
                }
            }
        }
        return Array.from(result);
    }

    /**
     * Returns all source nodes (nodes with no incoming edges).
     *
     * @returns {Array} An array of source nodes.
     */
    getSources() {
        const nonSources = new Set();
        for (const [srcId, targets] of this.edges) {
            for (const tgtId of targets) {
                nonSources.add(tgtId.toString("hex"));
            }
        }
        const sources = [];
        for (const [id, node] of this.nodes) {
            if (!nonSources.has(id.toString("hex"))) {
                sources.push(node);
            }
        }
        return sources;
    }

    /**
     * Returns all sink nodes (nodes with no outgoing edges).
     *
     * @returns {Array} An array of sink nodes.
     */
    getSinks() {
        const sinks = [];
        for (const [id, targets] of this.edges) {
            if (targets.size === 0) {
                sinks.push(this.nodes.get(id));
            }
        }
        return sinks;
    }

    /**
     * Asynchronously calls the `update()` method on all computed nodes in the graph.
     *
     * Nodes are updated in topological order to ensure that dependencies are updated before their dependents.
     * Assumes that node.update() returns a Promise.
     *
     * @returns {Promise<void>} A promise that resolves when all nodes have been updated.
     */
    async updateAsync() {
        const sortedIds = this.topologicalSort();
        for (const id of sortedIds) {
            const node = this.nodes.get(id);
            if (node.fn) {
                await node.update();
            }
        }
    }

    /**
     * Returns a human-readable string representation of the graph.
     *
     * Each line represents an edge in the format "source -> target".
     *
     * @returns {string} A string representation of the graph.
     */
    toString() {
        let result = "";
        for (const [srcId, targets] of this.edges) {
            const srcKey = this.decodeKey(srcId);
            for (const tgtId of targets) {
                const tgtKey = this.decodeKey(tgtId);
                result += `${srcKey} -> ${tgtKey}\n`;
            }
        }
        return result;
    }

    /**
     * Finds a path from the source node to the target node using depth-first search.
     *
     * @param {string|Buffer|Object} srcRef - The source node reference.
     * @param {string|Buffer|Object} tgtRef - The target node reference.
     * @returns {Array<Buffer>|null} An array of Buffer keys representing the path, or null if no path is found.
     */
    findPath(srcRef, tgtRef) {
        const srcId = this._resolveId(srcRef);
        const tgtId = this._resolveId(tgtRef);
        const stack = [[srcId]];
        const visited = new Set();

        while (stack.length) {
            const path = stack.pop();
            const last = path[path.length - 1];
            if (b4a.equals(last, tgtId)) {
                return path;
            }
            if (visited.has(last.toString("hex"))) continue;
            visited.add(last.toString("hex"));

            const neighbors = this.edges.get(last) || new Set();
            for (const neighbor of neighbors) {
                stack.push([...path, neighbor]);
            }
        }
        return null; // No path found.
    }

    /**
     * Returns the number of incoming edges (in-degree) for the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {number} The in-degree of the node.
     */
    getInDegree(ref) {
        const id = this._resolveId(ref);
        let count = 0;
        for (const [srcId, targets] of this.edges) {
            for (const target of targets) {
                if (b4a.equals(target, id)) {
                    count++;
                    break;
                }
            }
        }
        return count;
    }

    /**
     * Determines whether the graph contains a node with the given reference.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {boolean} True if the node exists, false otherwise.
     */
    hasNode(ref) {
        const id = this._resolveId(ref);
        return this.nodes.has(id);
    }

    /**
     * Returns the number of outgoing edges (out-degree) for the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {number} The out-degree of the node.
     */
    getOutDegree(ref) {
        const id = this._resolveId(ref);
        const targets = this.edges.get(id) || new Set();
        return targets.size;
    }

    /**
     * Determines whether an edge exists from the source node to the target node.
     *
     * @param {string|Buffer|Object} srcRef - The source node reference.
     * @param {string|Buffer|Object} tgtRef - The target node reference.
     * @returns {boolean} True if the edge exists, false otherwise.
     */
    hasEdge(srcRef, tgtRef) {
        const srcId = this._resolveId(srcRef);
        const tgtId = this._resolveId(tgtRef);
        if (!this.nodes.has(srcId) || !this.nodes.has(tgtId)) {
            return false;
        }
        const targets = this.edges.get(srcId);
        for (const target of targets) {
            if (b4a.equals(target, tgtId)) return true;
        }
        return false;
    }

    /**
     * Removes all nodes and edges from the graph.
     */
    clear() {
        this.nodes.clear();
        this.edges.clear();
    }

    /**
     * Retrieves the connected component (cluster) for the given node.
     *
     * The connected component consists of all nodes that are connected to the given node,
     * regardless of the edge direction.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {Array} An array of nodes that form the connected component.
     */
    getConnectedComponent(ref) {
        const startId = this._resolveId(ref);
        const visited = new Set();
        const stack = [startId];
        const component = new Set();

        while (stack.length) {
            const currentId = stack.pop();
            const hex = currentId.toString("hex");
            if (visited.has(hex)) continue;
            visited.add(hex);
            component.add(this.nodes.get(currentId));

            // Check outgoing neighbors.
            const outNeighbors = this.edges.get(currentId) || new Set();
            for (const neighbor of outNeighbors) {
                stack.push(neighbor);
            }
            // Check incoming neighbors.
            for (const [srcId, targets] of this.edges) {
                for (const target of targets) {
                    if (b4a.equals(target, currentId)) {
                        stack.push(srcId);
                    }
                }
            }
        }
        return Array.from(component);
    }
}

export { ReactiveGraph };
