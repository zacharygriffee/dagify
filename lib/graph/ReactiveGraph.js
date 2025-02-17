import b4a from "b4a";
import BufferMap from "tiny-buffer-map";
import z32 from "z32"; // z32 provides encode() and decode() methods

/**
 * Represents a reactive dependency graph for dagify nodes.
 *
 * Each node is stored using a Buffer key. A node’s id is defined as the z32‑encoded string
 * representation of that key.
 *
 * @example
 * const graph = new ReactiveGraph();
 * const node1 = createNode(4);         // node1.key is a Buffer
 * const node2 = createNode(() => 6);     // node2.key is a Buffer
 * // node1.id === z32.encode(node1.key)
 * graph.addNode(node1);
 * graph.addNode(node2);
 * graph.connect(node1, node2);
 */
class ReactiveGraph {
    /**
     * Creates an instance of ReactiveGraph.
     *
     * @param {Object} [config={}] - Optional configuration object.
     */
    constructor(config = {}) {
        this.nodes = new BufferMap(); // Map<Buffer, node>
        this.edges = new BufferMap(); // Map<Buffer, Set<Buffer>>
    }

    /**
     * Returns a node's id as a z32‑encoded string.
     *
     * @param {Buffer} key - The node's key.
     * @returns {string} The z32‑encoded id.
     */
    _idForKey(key) {
        return z32.encode(key);
    }

    /**
     * Resolves a node reference into a Buffer key.
     *
     * Expects one of:
     * - A string: assumed to be a z32‑encoded id and decoded into a Buffer.
     * - A Buffer: returned as is.
     * - A dagify node object: must have isDagifyNode===true and a `key` property (a Buffer).
     *
     * @private
     * @param {string|Buffer|Object} ref - A string, Buffer, or dagify node object.
     * @returns {Buffer} The resolved Buffer key.
     * @throws {Error} If the reference is invalid.
     */
    _resolveKey(ref) {
        try {
            if (typeof ref === "string") {
                return z32.decode(ref);
            }
            if (b4a.isBuffer(ref)) {
                return ref;
            }
            if (ref && typeof ref === "object" && ref.isDagifyNode === true) {
                if (!ref.key || !b4a.isBuffer(ref.key)) {
                    throw new Error("Dagify node must have a key property that is a Buffer.");
                }
                return ref.key;
            }
        } catch (e) {};
        throw new Error("Invalid node reference: must be a string, Buffer, or dagify node object.");
    }

    /**
     * Retrieves an existing node by its key or adds a new node to the graph if it doesn't exist.
     *
     * @param {Object} node - A dagify node object (with isDagifyNode===true and a key property).
     * @returns {Object} The existing or newly added node.
     * @throws {Error} If the provided node is invalid.
     */
    upsertNode(node) {
        if (!node || node.isDagifyNode !== true) {
            throw new Error("Invalid node: expected a dagify node object with isDagifyNode===true.");
        }
        const key = this._resolveKey(node);
        if (this.nodes.has(key)) {
            return this.nodes.get(key);
        }
        this.nodes.set(key, node);
        this.edges.set(key, new Set());
        return node;
    }

    /**
     * Adds a node to the graph.
     *
     * @param {Object} node - A dagify node object (with isDagifyNode===true and a key property).
     * @throws {Error} If the node is invalid or a node with the same key already exists.
     */
    addNode(node) {
        if (!node || node.isDagifyNode !== true) {
            throw new Error("Invalid node: expected a dagify node object with isDagifyNode===true.");
        }
        const key = this._resolveKey(node);
        if (this.nodes.has(key)) {
            throw new Error(`Node '${this._idForKey(key)}' already exists.`);
        }
        this.nodes.set(key, node);
        this.edges.set(key, new Set());
    }

    /**
     * Adds multiple nodes to the graph.
     *
     * @param {Object[]} nodes - An array of dagify node objects.
     * @throws {Error} If any node is invalid or if a node with the same key already exists.
     */
    addNodes(nodes) {
        for (const node of nodes) {
            this.addNode(node);
        }
    }

    /**
     * Removes a node and all its connections from the graph.
     *
     * Both outgoing and incoming edges are removed.
     *
     * @param {string|Buffer|Object} nodeRef - The node reference to remove.
     * @throws {Error} If the node does not exist.
     */
    removeNode(nodeRef) {
        const key = this._resolveKey(nodeRef);
        if (!this.nodes.has(key)) {
            throw new Error(`Node '${this._idForKey(key)}' does not exist.`);
        }

        // Remove outgoing edges.
        for (const tgtKey of this.edges.get(key)) {
            const tgtNode = this.nodes.get(tgtKey);
            const srcNode = this.nodes.get(key);
            if (tgtNode && tgtNode.fn) {
                tgtNode.removeDependency(srcNode);
            }
        }
        this.edges.delete(key);

        // Remove incoming edges.
        for (const [srcKey, targets] of this.edges) {
            for (const tgt of targets) {
                if (b4a.equals(tgt, key)) {
                    targets.delete(tgt);
                    const srcNode = this.nodes.get(srcKey);
                    const tgtNode = this.nodes.get(key);
                    if (tgtNode && tgtNode.fn) {
                        tgtNode.removeDependency(srcNode);
                    }
                    break;
                }
            }
        }
        this.nodes.delete(key);
    }

    /**
     * Connects two nodes by adding an edge from source to target.
     *
     * If the target node is computed, the source node is added as a dependency.
     *
     * @param {string|Buffer|Object} srcRef - The source node reference.
     * @param {string|Buffer|Object} tgtRef - The target node reference.
     * @throws {Error} If either node does not exist or if the connection would create a cycle.
     */
    connect(srcRef, tgtRef) {
        const srcRefs = Array.isArray(srcRef) && !b4a.isBuffer(srcRef) ? srcRef : [srcRef];
        const tgtRefs = Array.isArray(tgtRef) && !b4a.isBuffer(tgtRef) ? tgtRef : [tgtRef];

        for (const src of srcRefs) {
            const srcKey = this._resolveKey(src);
            for (const tgt of tgtRefs) {
                const tgtKey = this._resolveKey(tgt);

                if (!this.nodes.has(srcKey) || !this.nodes.has(tgtKey)) {
                    throw new Error(
                        `Invalid node references '${this._idForKey(srcKey)}', '${this._idForKey(tgtKey)}'.`
                    );
                }

                if (this.createsCycle(srcKey, tgtKey)) {
                    throw new Error(
                        `Connecting ${this._idForKey(srcKey)} -> ${this._idForKey(tgtKey)} would create a cycle.`
                    );
                }

                this.edges.get(srcKey).add(tgtKey);

                const tgtNode = this.nodes.get(tgtKey);
                const srcNode = this.nodes.get(srcKey);
                if (tgtNode.fn) {
                    if (Array.isArray(tgtNode.normalizedDeps)) {
                        tgtNode.addDependency(srcNode);
                    } else if (tgtNode.normalizedDeps && typeof tgtNode.normalizedDeps === "object") {
                        const depId = z32.encode(srcKey);
                        if (!(depId in tgtNode.normalizedDeps)) {
                            tgtNode.updateDependencies(deps => ({ ...deps, [depId]: srcNode }));
                        }
                    }
                }
            }
        }
    }

    /**
     * Disconnects the source node(s) from the target node(s).
     *
     * @param {string|Buffer|Object|(string|Buffer|Object)[]} srcRef - The source node reference(s).
     * @param {string|Buffer|Object|(string|Buffer|Object)[]} tgtRef - The target node reference(s).
     */
    disconnect(srcRef, tgtRef) {
        const srcRefs = Array.isArray(srcRef) ? srcRef : [srcRef];
        const tgtRefs = Array.isArray(tgtRef) ? tgtRef : [tgtRef];

        for (const src of srcRefs) {
            const srcKey = this._resolveKey(src);
            for (const tgt of tgtRefs) {
                const tgtKey = this._resolveKey(tgt);
                if (!this.nodes.has(srcKey) || !this.nodes.has(tgtKey)) {
                    throw new Error(
                        `Invalid node references '${this._idForKey(srcKey)}', '${this._idForKey(tgtKey)}'.`
                    );
                }
                const targets = this.edges.get(srcKey);
                let found = false;
                for (const key of targets) {
                    if (b4a.equals(key, tgtKey)) {
                        targets.delete(key);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    throw new Error(
                        `No edge exists from '${this._idForKey(srcKey)}' to '${this._idForKey(tgtKey)}'.`
                    );
                }
                const tgtNode = this.nodes.get(tgtKey);
                const srcNode = this.nodes.get(srcKey);
                if (tgtNode.fn) {
                    tgtNode.removeDependency(srcNode);
                }
            }
        }
    }

    /**
     * Checks whether connecting the source node to the target node would create a cycle.
     *
     * @param {Buffer} srcKey - The source node key.
     * @param {Buffer} tgtKey - The target node key.
     * @returns {boolean} True if a cycle would be created, false otherwise.
     */
    createsCycle(srcKey, tgtKey) {
        const visited = new Set();
        const stack = [tgtKey];
        while (stack.length > 0) {
            const current = stack.pop();
            if (b4a.equals(current, srcKey)) return true;
            const currentId = z32.encode(current);
            if (!visited.has(currentId)) {
                visited.add(currentId);
                const neighbors = this.edges.get(current) || new Set();
                for (const neighbor of neighbors) {
                    stack.push(neighbor);
                }
            }
        }
        return false;
    }



    /**
     * Calls the update() method on all computed nodes in topological order so that dependencies are updated before dependents.
     */
    update() {
        const sortedKeys = this.topologicalSort();
        for (const key of sortedKeys) {
            const node = this.nodes.get(key);
            if (node.fn) {
                node.update();
            }
        }
    }

    /* ===== Utility Methods for Node Retrieval and Graph Introspection ===== */

    /**
     * Retrieves a node (or nodes) from the graph.
     *
     * @param {string|Buffer|Object|Array} refOrRefs - A node reference or an array of node references.
     * @returns {Object|Array} The corresponding node or array of nodes.
     * @throws {Error} If any node does not exist.
     */
    getNode(refOrRefs) {
        if (Array.isArray(refOrRefs)) {
            return refOrRefs.map(ref => this._getNode(ref));
        }
        return this._getNode(refOrRefs);
    }

    /**
     * Returns an array of all nodes in the graph.
     *
     * @returns {Array} An array containing all node objects.
     */
    getNodes() {
        return Array.from(this.nodes.values());
    }

    /**
     * Returns an array of all edges in the graph.
     *
     * Each edge is represented as an object with 'src' and 'tgt' properties.
     *
     * @returns {Array} An array of edge objects.
     */
    getEdges() {
        const edges = [];
        for (const [srcKey, targets] of this.edges) {
            const src = this.nodes.get(srcKey);
            for (const tgtKey of targets) {
                const tgt = this.nodes.get(tgtKey);
                edges.push({ src, tgt });
            }
        }
        return edges;
    }

    /**
     * Finds and returns the first node that matches the given predicate.
     *
     * @param {Function} predicate - A function that takes a node and returns a boolean.
     * @returns {Object|null} The first matching node, or null if none match.
     */
    findNode(predicate) {
        for (const node of this.nodes.values()) {
            if (predicate(node)) return node;
        }
        return null;
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
        const key = this._resolveKey(ref);
        if (!this.nodes.has(key)) {
            throw new Error(`Node '${z32.encode(key)}' does not exist.`);
        }
        return this.nodes.get(key);
    }

    /**
     * Returns the immediate predecessor nodes (direct sources) of the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {Array} An array of immediate predecessor nodes.
     */
    getImmediatePredecessors(ref) {
        const key = this._resolveKey(ref);
        const predecessors = [];
        for (const [srcKey, targets] of this.edges) {
            for (const target of targets) {
                if (b4a.equals(target, key)) {
                    predecessors.push(this.nodes.get(srcKey));
                    break;
                }
            }
        }
        return predecessors;
    }

    /**
     * Returns the predecessor nodes of the given node.
     *
     * If options.transitive is true, returns all transitive predecessors; otherwise, only immediate ones.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @param {Object} [options={ transitive: false }] - Options.
     * @returns {Array} An array of predecessor nodes.
     */
    getPredecessors(ref, options = { transitive: false }) {
        if (!options.transitive) return this.getImmediatePredecessors(ref);
        const startKey = this._resolveKey(ref);
        const visited = new Set();
        const result = new Set();
        const stack = [startKey];
        while (stack.length > 0) {
            const currentKey = stack.pop();
            for (const [srcKey, targets] of this.edges) {
                for (const target of targets) {
                    if (b4a.equals(target, currentKey)) {
                        const srcId = z32.encode(srcKey);
                        if (!visited.has(srcId)) {
                            visited.add(srcId);
                            result.add(this.nodes.get(srcKey));
                            stack.push(srcKey);
                        }
                        break;
                    }
                }
            }
        }
        return Array.from(result);
    }

    /**
     * Returns the immediate successor nodes (direct dependents) of the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {Array} An array of immediate successor nodes.
     */
    getImmediateSuccessors(ref) {
        const key = this._resolveKey(ref);
        const successors = [];
        const targets = this.edges.get(key) || new Set();
        for (const tgtKey of targets) {
            successors.push(this.nodes.get(tgtKey));
        }
        return successors;
    }

    /**
     * Returns the successor nodes of the given node.
     *
     * If options.transitive is true, returns all transitive successors; otherwise, only immediate ones.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @param {Object} [options={ transitive: false }] - Options.
     * @returns {Array} An array of successor nodes.
     */
    getSuccessors(ref, options = { transitive: false }) {
        if (!options.transitive) return this.getImmediateSuccessors(ref);
        const startKey = this._resolveKey(ref);
        const visited = new Set();
        const result = new Set();
        const stack = [startKey];
        while (stack.length > 0) {
            const currentKey = stack.pop();
            const targets = this.edges.get(currentKey) || new Set();
            for (const tgtKey of targets) {
                const id = z32.encode(tgtKey);
                if (!visited.has(id)) {
                    visited.add(id);
                    result.add(this.nodes.get(tgtKey));
                    stack.push(tgtKey);
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
        for (const [srcKey, targets] of this.edges) {
            for (const tgtKey of targets) {
                nonSources.add(z32.encode(tgtKey));
            }
        }
        const sources = [];
        for (const [key, node] of this.nodes) {
            if (!nonSources.has(z32.encode(key))) {
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
        for (const [key, targets] of this.edges) {
            if (targets.size === 0) {
                sinks.push(this.nodes.get(key));
            }
        }
        return sinks;
    }

    /**
     * Asynchronously calls update() on all computed nodes in topological order so that dependencies update first.
     *
     * @returns {Promise<void>} A promise that resolves when all updates are complete.
     */
    async updateAsync() {
        const sortedKeys = this.topologicalSort();
        for (const key of sortedKeys) {
            const node = this.nodes.get(key);
            if (node.fn) {
                await node.update();
            }
        }
    }

    /**
     * Returns an array of node keys sorted in topological order.
     *
     * @returns {Buffer[]} An array of Buffer keys sorted topologically.
     * @throws {Error} If the graph contains a cycle.
     */
    topologicalSort() {
        const inDegree = new BufferMap();
        for (const key of this.nodes.keys()) {
            inDegree.set(key, 0);
        }
        for (const [src, targets] of this.edges) {
            for (const tgt of targets) {
                inDegree.set(tgt, inDegree.get(tgt) + 1);
            }
        }
        const queue = [];
        for (const [key, degree] of inDegree) {
            if (degree === 0) queue.push(key);
        }
        const sorted = [];
        while (queue.length) {
            const key = queue.shift();
            sorted.push(key);
            const targets = this.edges.get(key) || new Set();
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
     * Returns a string representation of the graph.
     *
     * Each line is in the format "source -> target" (using z32‑encoded ids).
     *
     * @returns {string} A string representing the graph edges.
     */
    toString() {
        let result = "";
        for (const [srcKey, targets] of this.edges) {
            for (const tgtKey of targets) {
                result += `${z32.encode(srcKey)} -> ${z32.encode(tgtKey)}\n`;
            }
        }
        return result;
    }

    /**
     * Finds a path from the source node to the target node using depth-first search.
     *
     * @param {string|Buffer|Object} srcRef - The source node reference.
     * @param {string|Buffer|Object} tgtRef - The target node reference.
     * @returns {Array<Buffer>|null} An array of Buffer keys representing the path, or null if none is found.
     */
    findPath(srcRef, tgtRef) {
        const srcId = this._resolveKey(srcRef);
        const tgtId = this._resolveKey(tgtRef);
        const stack = [[srcId]];
        const visited = new Set();

        while (stack.length) {
            const path = stack.pop();
            const last = path[path.length - 1];
            if (b4a.equals(last, tgtId)) return path;
            const lastId = z32.encode(last);
            if (visited.has(lastId)) continue;
            visited.add(lastId);
            const neighbors = this.edges.get(last) || new Set();
            for (const neighbor of neighbors) {
                stack.push([...path, neighbor]);
            }
        }
        return null;
    }

    /**
     * Returns the number of incoming edges (in-degree) for the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {number} The in-degree.
     */
    getInDegree(ref) {
        const key = this._resolveKey(ref);
        let count = 0;
        for (const [srcKey, targets] of this.edges) {
            for (const target of targets) {
                if (b4a.equals(target, key)) {
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
        const key = this._resolveKey(ref);
        return this.nodes.has(key);
    }

    /**
     * Returns the number of outgoing edges (out-degree) for the given node.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {number} The out-degree.
     */
    getOutDegree(ref) {
        const key = this._resolveKey(ref);
        const targets = this.edges.get(key) || new Set();
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
        const srcKey = this._resolveKey(srcRef);
        const tgtKey = this._resolveKey(tgtRef);
        if (!this.nodes.has(srcKey) || !this.nodes.has(tgtKey)) return false;
        const targets = this.edges.get(srcKey);
        for (const target of targets) {
            if (b4a.equals(target, tgtKey)) return true;
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
     * regardless of edge direction.
     *
     * @param {string|Buffer|Object} ref - The node reference.
     * @returns {Array} An array of nodes in the connected component.
     */
    getConnectedComponent(ref) {
        const startKey = this._resolveKey(ref);
        const visited = new Set();
        const stack = [startKey];
        const component = new Set();

        while (stack.length) {
            const currentKey = stack.pop();
            const currentId = z32.encode(currentKey);
            if (visited.has(currentId)) continue;
            visited.add(currentId);
            component.add(this.nodes.get(currentKey));

            // Outgoing neighbors.
            const outNeighbors = this.edges.get(currentKey) || new Set();
            for (const neighbor of outNeighbors) {
                stack.push(neighbor);
            }
            // Incoming neighbors.
            for (const [srcKey, targets] of this.edges) {
                for (const target of targets) {
                    if (b4a.equals(target, currentKey)) {
                        stack.push(srcKey);
                    }
                }
            }
        }
        return Array.from(component);
    }
}

export { ReactiveGraph };
