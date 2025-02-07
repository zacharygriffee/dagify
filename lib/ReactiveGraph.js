import b4a from "b4a";
import BufferMap from "tiny-buffer-map";
import cenc from "compact-encoding";

class ReactiveGraph {
    constructor(config = {}) {
        const { keyEncoding = "binary" } = config;
        this.keyEncoding = cenc.from(keyEncoding);
        // Both nodes and edges use Buffer keys.
        this.nodes = new BufferMap(); // Map<Buffer, node>
        this.edges = new BufferMap(); // Map<Buffer, Set<Buffer>>
    }

    decodeKey(key) {
        return cenc.decode(this.keyEncoding, key);
    }

    encodeKey(key) {
        if (b4a.isBuffer(key)) return key;
        return cenc.encode(this.keyEncoding, key);
    }

    /**
     * Resolves a node reference into a Buffer key.
     * @param {string|Buffer|Object} ref - A string, Buffer, or dagify node.
     * @returns {Buffer}
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
     * Removes a node and its connections.
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
     * Connects two nodes by adding an edge from source to target.
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
     * Disconnects two nodes by removing the edge.
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
     * Checks for cycle creation.
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
     * Returns an array of Buffer keys sorted in topological order.
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
     * Calls update() on all computed nodes in topological order.
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
}

export { ReactiveGraph };
