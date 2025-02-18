import {getEncoder} from "./getEncoding.js";
import b4a from "b4a";
import z32 from "z32";
import {createNode} from "../node/index.js";
import ProtomuxRPC from "protomux-rpc";
import {handshakeEncoding} from "./handshakeEncoding.js";
import cenc from "compact-encoding";

const PROTOCOL = "dagify/1.2";
const syncNode = (nodeOrKey, config = {}) => {
    let node;
    let key;
    let isRemote;
    let localEncoder;

    const {valueEncoding} = config;

    if (valueEncoding != null && typeof valueEncoding !== "string") {
        throw new Error("Value Encoding must be a string");
    } else if (valueEncoding != null && typeof valueEncoding === "string") {
        localEncoder = getEncoder(valueEncoding);
    }

    // Default local mode if not provided.
    config.mode ||= "transform";

    if (typeof nodeOrKey === "string" || b4a.isBuffer(nodeOrKey)) {
        isRemote = true;
        key = typeof nodeOrKey === "string" ? z32.decode(nodeOrKey) : nodeOrKey;
        node = createNode();
        node.key = key;
    } else {
        isRemote = false;
        node = nodeOrKey;
        key = node.key;
    }


    // A flag to prevent echoing remote updates.
    let suppressNext = false;

    return {
        node,
        sync(socket) {
            // Send our local mode as handshake metadata (as a JSON string).
            const localMode = config.mode;
            const handshakeData = {mode: localMode, valueEncoding};
            const rpc = new ProtomuxRPC(socket, {
                id: key,
                protocol: PROTOCOL,
                handshake: handshakeData,
                handshakeEncoding
            });

            // When connection opens, we get remote handshake data.
            rpc.once("open", (remoteHandshake) => {
                const remoteEncoder = localEncoder || getEncoder(remoteHandshake.valueEncoding);
                const remoteMode = remoteHandshake.mode || "transform";
                loadRpcMethods(localMode, remoteMode, remoteEncoder);
            });
            return rpc.fullyOpened();

            function loadRpcMethods(localMode, remoteMode, remoteEncoder) {
                // Resolve the encoders:
                // _localEncoder is used when sending events from this side.
                // _remoteEncoder is used when decoding events coming from the remote side.
                // We default to using our config values if remoteEncoder isn’t provided.
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
export {syncNode};