import { getEncoder } from "../util/getEncoder.js";
import b4a from "b4a";
import z32 from "z32";
import { createNode } from "../node/index.js";
import ProtomuxRPC from "protomux-rpc";
import { handshakeEncoding } from "./handshakeEncoding.js";
import cenc from "compact-encoding";
import crypto from "hypercore-crypto";

const PROTOCOL = "dagify/1.2";

/**
 * Creates a sync object that enables network replication for a node.
 *
 * The function negotiates modes (sink, source, or transform) via handshake metadata,
 * resolves the appropriate value encoder, and sets up RPC responders and event subscriptions
 * to synchronize state between the local and remote nodes.
 *
 * @param {ReactiveNode|string|Buffer} nodeOrKey - Either an existing node to sync or a key (string or Buffer) for a remote node.
 * @param {Object} [config={}] - Configuration object.
 * @param {string} [config.valueEncoding] - The value encoding as a string (e.g. "utf8"). Must be a string if provided.
 * @param {string} [config.mode="transform"] - The local mode, one of "sink", "source", or "transform". Defaults to "transform".
 * @returns {Object} An object with the synchronized node and a sync method.
 * @throws {Error} If the provided valueEncoding is not a string.
 */
const syncNode = (nodeOrKey, config = {}) => {
    let node;
    let key;
    let localEncoder;

    const { valueEncoding } = config;

    if (valueEncoding != null && typeof valueEncoding !== "string") {
        throw new Error("Value Encoding must be a string");
    } else if (valueEncoding != null && typeof valueEncoding === "string") {
        localEncoder = getEncoder(valueEncoding);
    }

    let isOwner, hash, proof;

    // Default local mode if not provided.
    config.mode ||= "transform";

    if (typeof nodeOrKey === "string" || b4a.isBuffer(nodeOrKey)) {
        key = typeof nodeOrKey === "string" ? z32.decode(nodeOrKey) : nodeOrKey;
        // Create a remote node with an undefined value; only the publicKey is provided.
        node = createNode(undefined, { keyPair: { publicKey: key } });
    } else {
        // If an existing node is provided, mark it as owner.
        node = nodeOrKey;
        key = node.key;
        isOwner = true;
        hash = crypto.randomBytes(32);
        proof = node._sign(hash);
    }

    // A flag to prevent echoing remote updates back to the sender.
    let suppressNext = false;

    return {
        /** The synchronized node. */
        node,
        /**
         * Establishes the RPC-based synchronization on the provided socket.
         *
         * The handshake sends local mode and encoding metadata. On connection, remote handshake data
         * is used to verify ownership (if applicable) and to negotiate the remote mode and encoding.
         * RPC responders and event subscriptions are then set up based on the negotiated modes.
         *
         * @param {Socket} socket - The underlying network socket for the RPC connection.
         * @returns {Promise<ProtomuxRPC>} A promise that resolves when the RPC connection is fully opened.
         */
        sync(socket) {
            // Prepare handshake metadata.
            const localMode = config.mode;
            const handshakeData = { isOwner, proof, hash, mode: localMode, valueEncoding };
            const rpc = new ProtomuxRPC(socket, {
                id: key,
                protocol: PROTOCOL,
                handshake: handshakeData,
                handshakeEncoding
            });

            // When the connection is open, process remote handshake data.
            rpc.once("open", (remoteHandshake) => {
                const { isOwner, hash, proof } = remoteHandshake;

                // If the remote claims ownership, verify its proof.
                if (isOwner) {
                    if (!crypto.verify(hash, proof, key)) {
                        socket.destroy();
                        return;
                    }
                }

                // Resolve remote encoding: prefer localEncoder if available; otherwise, get from remote metadata.
                const remoteEncoder = localEncoder || getEncoder(remoteHandshake.valueEncoding);
                const remoteMode = remoteHandshake.mode || "transform";
                loadRpcMethods(localMode, remoteMode, remoteEncoder);
            });

            return rpc.fullyOpened().then(() => {
                if (node.isComposite) node.update();
            })

            /**
             * Configures RPC methods based on local and remote modes and encoders.
             *
             * - If the local node is configured to receive updates (sink or transform)
             *   and the remote side is configured to send (source or transform),
             *   a responder is registered to update the node's state.
             *
             * - If the local node is configured to send updates (source or transform)
             *   and the remote side is configured to receive (sink or transform),
             *   a subscription is set up to emit local state changes.
             *
             * @param {string} localMode - The local mode ("sink", "source", or "transform").
             * @param {string} remoteMode - The remote mode ("sink", "source", or "transform").
             * @param {Function} remoteEncoder - The encoder to use for decoding incoming remote messages.
             */
            function loadRpcMethods(localMode, remoteMode, remoteEncoder) {
                // Resolve the encoders:
                // _localEncoder is used when sending events from this side.
                // _remoteEncoder is used when decoding events coming from the remote side.
                const _localEncoder = localEncoder || cenc.binary;
                const _remoteEncoder = remoteEncoder || cenc.binary;

                // If our local node is configured to receive updates (sink or transform)
                // and the remote side is configured to send (source or transform), register a responder.
                if ((localMode === "sink" || localMode === "transform") &&
                    (remoteMode === "source" || remoteMode === "transform")) {
                    rpc.respond("stateUpdate", {
                        // Incoming messages from remote will be decoded using _remoteEncoder.
                        requestEncoding: _remoteEncoder
                        // responseEncoding is omitted if we don't need to send a reply.
                    }, value => {
                        suppressNext = true;
                        node.set(value);
                    });
                }

                // If our local node is configured to send updates (source or transform)
                // and the remote side is configured to receive (sink or transform), subscribe to local changes.
                if ((localMode === "source" || localMode === "transform") &&
                    (remoteMode === "sink" || remoteMode === "transform")) {
                    const sub = node.subscribe(value => {
                        if (value != null) {
                            if (!suppressNext) {
                                // Outgoing events are encoded using _localEncoder.
                                rpc.event("stateUpdate", value, {
                                    requestEncoding: _localEncoder
                                });
                            } else {
                                suppressNext = false;
                            }
                        }
                    });
                    rpc.once("close", () => sub.unsubscribe());
                }
            }
        }
    };
};

export { syncNode, PROTOCOL };
