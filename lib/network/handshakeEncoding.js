import cenc from "compact-encoding";

export const handshakeEncoding = {
    preencode(state, {isOwner, valueEncoding, mode, proof, hash}) {
        cenc.bool.preencode(state, isOwner);
        if (isOwner) {
            cenc.fixed64.preencode(state, proof);
            cenc.fixed32.preencode(state, hash);
        }
        cenc.utf8.preencode(state, valueEncoding ?? "");
        cenc.utf8.preencode(state, mode);
    },
    encode(state, {isOwner, valueEncoding, mode, proof, hash}) {
        cenc.bool.encode(state, isOwner);
        if (isOwner) {
            cenc.fixed64.encode(state, proof);
            cenc.fixed32.encode(state, hash);
        }
        cenc.utf8.encode(state, valueEncoding ?? "");
        cenc.utf8.encode(state, mode);
    },
    decode(buffer) {
        const isOwner = cenc.bool.decode(buffer);

        let proof, hash;
        if (isOwner) {
            proof = cenc.fixed64.decode(buffer);
            hash = cenc.fixed32.decode(buffer);
        }

        let valueEncoding = cenc.utf8.decode(buffer);
        if (!valueEncoding.length) valueEncoding = null;
        const mode = cenc.utf8.decode(buffer);
        return {
            valueEncoding,
            mode,
            proof,
            hash,
            isOwner
        };
    }
};