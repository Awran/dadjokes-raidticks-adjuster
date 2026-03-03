const nodeCrypto = require('crypto')

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = nodeCrypto
} else if (typeof globalThis.crypto.randomUUID !== 'function' && typeof nodeCrypto.randomUUID === 'function') {
  globalThis.crypto.randomUUID = nodeCrypto.randomUUID
}
