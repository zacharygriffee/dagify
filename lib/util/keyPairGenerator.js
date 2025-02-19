import crypto from "hypercore-crypto";

export const keyPairGenerator = () => {
    return crypto.keyPair()
}