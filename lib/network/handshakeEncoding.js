import cenc from "compact-encoding";

export const handshakeEncoding = {
    preencode(state, {valueEncoding, mode}) {
        cenc.utf8.preencode(state, valueEncoding ?? "");
        cenc.utf8.preencode(state, mode);
    },
    encode(state, {valueEncoding, mode}) {
        cenc.utf8.encode(state, valueEncoding ?? "");
        cenc.utf8.encode(state, mode);
    },
    decode(buffer) {
        let valueEncoding = cenc.utf8.decode(buffer);
        if (!valueEncoding.length) valueEncoding = null;
        const mode = cenc.utf8.decode(buffer);
        return {
            valueEncoding,
            mode
        };
    }
};