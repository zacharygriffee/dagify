import b4a from "b4a";
import BufferMap from "tiny-buffer-map";
import cenc from "compact-encoding";

/**
 * Represents a reactive directed acyclic graph (DAG).
 */
class ReactiveGraph {
    /**
     * @param {Object} [config={}] - Configuration object.
     * @param {string} [config.keyEncoding="binary"] - Encoding type for keys.
     */
    constructor(config = {}) {
        const { keyEncoding = "binary" } = config;
        this.keyEncoding = cenc.from(keyEncoding);
        /** @type {BufferMap<Buffer, Object>} */
        this.nodes = new BufferMap(); // Map<Buffer, node>
        /** @type {BufferMap<Buffer, Set<Buffer>>} */
        this.edges = new BufferMap(); // Map<Buffer, Set<Buffer>>
    }

    /**
     * Decodes a key from its binary representation.
     * @param {Buffer} key - The encoded key.
     * @returns {string|Buffer} - Decoded key.
     */
    decodeKey(key) {
        return cenc.decode(this.keyEncoding, key);
    }

    /**
     * Encodes a key into its binary representation.
     * @param {string|Buffer} key - The key to encode.
     * @returns {Buffer} - Encoded key.
     */
    encodeKey(key) {
        if (b4a.isBuffer(key)) return key;
        return cenc.encode(this.keyEncoding, key);
    }

    /**
     * Resolves a node reference into a Buffer key.
     * @param {string|Buffer|Object} ref - A string, Buffer, or dagify node.
     * @returns {Buffer} - Encoded key.
     * @throws {Error} - If the reference is invalid.
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
        throw new Error("Invalid node reference: must be a string, buffer, or dagify node object.");
    }

    /**
     * Adds a node to the graph.
     * @param {Object|string|Buffer} nodeOrId - The node or its identifier.
     * @param {Object} [maybeNode] - The node object if an ID is provided.
     * @throws {Error} - If the node is invalid or already exists.
     */
    addNode(nodeOrId, maybeNode) {
        let id, node;
        if (maybeNode === undefined) {
            if (!nodeOrId || nodeOrId.isDagifyNode !== true) {
                throw new Error("Invalid node: expected a dagify node object with isDagifyNode===true.");
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
     * Removes a node and its connections.
     * @param {string|Buffer|Object} nodeRef - The node reference.
     * @throws {Error} - If the node does not exist.
     */
    removeNode(nodeRef) {
        const id = this._resolveId(nodeRef);
        if (!this.nodes.has(id)) {
            throw new Error(`Node '${this.decodeKey(id)}' does not exist.`);
        }

        for (const tgtId of this.edges.get(id)) {
            const tgtNode = this.nodes.get(tgtId);
            const srcNode = this.nodes.get(id);
            if (tgtNode && tgtNode.fn) {
                tgtNode.removeDependency(srcNode);
            }
        }
        this.edges.delete(id);

        for (const [srcId, targets] of this.edges) {
            targets.delete(id);
        }

        this.nodes.delete(id);
    }

    /**
     * Connects two nodes by adding an edge.
     * @param {string|Buffer|Object} srcRef - Source node reference.
     * @param {string|Buffer|Object} tgtRef - Target node reference.
     * @throws {Error} - If nodes are invalid or if a cycle is detected.
     */
    connect(srcRef, tgtRef) {
        const srcId = this._resolveId(srcRef);
        const tgtId = this._resolveId(tgtRef);

        if (!this.nodes.has(srcId) || !this.nodes.has(tgtId)) {
            throw new Error(`Invalid node references '${this.decodeKey(srcId)}', '${this.decodeKey(tgtId)}'.`);
        }

        if (this.createsCycle(srcId, tgtId)) {
            throw new Error(`Connecting ${this.decodeKey(srcId)} -> ${this.decodeKey(tgtId)} would create a cycle.`);
        }

        this.edges.get(srcId).add(tgtId);
    }

    /**
     * Checks if adding an edge creates a cycle.
     * @param {Buffer} srcId - Source node ID.
     * @param {Buffer} tgtId - Target node ID.
     * @returns {boolean} - Whether a cycle would be created.
     */
    createsCycle(srcId, tgtId) {
        const visited = new Set();
        const stack = [tgtId];
        while (stack.length) {
            const current = stack.pop();
            if (b4a.equals(current, srcId)) return true;
            if (!visited.has(current.toString("hex"))) {
                visited.add(current.toString("hex"));
                stack.push(...this.edges.get(current) || []);
            }
        }
        return false;
    }

    /**
     * Sorts nodes in topological order.
     * @returns {Buffer[]} - Sorted node IDs.
     * @throws {Error} - If the graph contains cycles.
     */
    topologicalSort() {
        const inDegree = new BufferMap();
        for (const id of this.nodes.keys()) {
            inDegree.set(id, 0);
        }
        for (const targets of this.edges.values()) {
            for (const tgt of targets) {
                inDegree.set(tgt, inDegree.get(tgt) + 1);
            }
        }
        const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
        const sorted = [];
        while (queue.length) {
            const id = queue.shift();
            sorted.push(id);
            for (const neighbor of this.edges.get(id) || []) {
                inDegree.set(neighbor, inDegree.get(neighbor) - 1);
                if (inDegree.get(neighbor) === 0) queue.push(neighbor);
            }
        }
        if (sorted.length !== this.nodes.size) throw new Error("Graph has at least one cycle.");
        return sorted;
    }
}

export { ReactiveGraph };
