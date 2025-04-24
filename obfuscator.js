// Obfuscation utilities for post-quantum cryptography operations
class Obfuscator {
    constructor() {
        // No fixed key - we'll generate unique keys for each operation
    }

    // Generate a random obfuscation key
    generateObfuscationKey() {
        const key = new Uint8Array(32);
        crypto.getRandomValues(key);
        return key;
    }

    // Obfuscate binary data (for keys and ciphertexts)
    obfuscateBinary(data) {
        const obfuscationKey = this.generateObfuscationKey();
        const obfuscated = new Uint8Array(data.length + obfuscationKey.length);
        
        // Store the key at the beginning of the obfuscated data
        obfuscated.set(obfuscationKey, 0);
        
        // XOR the data with the key
        for (let i = 0; i < data.length; i++) {
            obfuscated[i + obfuscationKey.length] = data[i] ^ obfuscationKey[i % obfuscationKey.length];
        }
        
        return obfuscated;
    }

    // Deobfuscate binary data
    deobfuscateBinary(obfuscatedData) {
        // Extract the key from the beginning of the data
        const keyLength = 32;
        const obfuscationKey = obfuscatedData.slice(0, keyLength);
        const data = obfuscatedData.slice(keyLength);
        const deobfuscated = new Uint8Array(data.length);
        
        for (let i = 0; i < data.length; i++) {
            deobfuscated[i] = data[i] ^ obfuscationKey[i % obfuscationKey.length];
        }
        
        return deobfuscated;
    }

    // Obfuscate a string using XOR with a unique obfuscation key
    obfuscateString(str) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        return this.obfuscateBinary(data);
    }

    // Deobfuscate a string
    deobfuscateString(obfuscatedData) {
        const deobfuscated = this.deobfuscateBinary(obfuscatedData);
        const decoder = new TextDecoder();
        return decoder.decode(deobfuscated);
    }

    // Control flow obfuscation - split operations into multiple steps
    splitOperation(operation, steps) {
        const result = [];
        const stepSize = Math.ceil(operation.length / steps);
        
        for (let i = 0; i < operation.length; i += stepSize) {
            result.push(operation.slice(i, i + stepSize));
        }
        
        return result;
    }

    // Recombine split operations
    recombineOperations(splitOperations) {
        return splitOperations.reduce((acc, curr) => {
            return new Uint8Array([...acc, ...curr]);
        }, new Uint8Array(0));
    }
}

// Export the obfuscator
export default Obfuscator; 