import Obfuscator from './obfuscator.js';

class LibOQS {
    constructor() {
        this.module = null;
        this.initialized = false;
        this.obfuscator = new Obfuscator();
        
        // Define parameters for Kyber-768
        this.kem = {
            length_public_key: 1184,
            length_secret_key: 2400,
            length_ciphertext: 1088,
            length_shared_secret: 32,
            functions: {
                keypair: 'OQS_KEM_kyber_768_keypair',
                encaps: 'OQS_KEM_kyber_768_encaps',
                decaps: 'OQS_KEM_kyber_768_decaps'
            }
        };

        this.progressCallback = null;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    updateProgress(step, total, message) {
        if (this.progressCallback) {
            this.progressCallback(step, total, message);
        }
    }

    async init() {
        if (this.initialized) return;

        try {
            // Load the WebAssembly module
            const wasmPath = chrome.runtime.getURL('lib/liboqs.wasm');
            const wasmResponse = await fetch(wasmPath);
            if (!wasmResponse.ok) {
                throw new Error(`Failed to load WebAssembly module: ${wasmResponse.status} ${wasmResponse.statusText}`);
            }
            const wasmBinary = await wasmResponse.arrayBuffer();

            // Initialize the module with proper error handling
            const importObject = {
                env: {
                    memory: new WebAssembly.Memory({ initial: 256 }),
                    table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' }),
                    exit: (code) => {
                        console.log(`WebAssembly exited with code: ${code}`);
                    },
                    emscripten_resize_heap: (requestedSize) => {
                        console.log(`Resizing heap to ${requestedSize} bytes`);
                        return 0;
                    },
                    _abort_js: () => {
                        console.error('WebAssembly aborted');
                        throw new Error('WebAssembly aborted');
                    }
                },
                wasi_snapshot_preview1: {
                    args_get: () => 0,
                    args_sizes_get: () => 0,
                    environ_get: () => 0,
                    environ_sizes_get: () => 0,
                    clock_res_get: () => 0,
                    clock_time_get: () => 0,
                    fd_advise: () => 0,
                    fd_allocate: () => 0,
                    fd_close: () => 0,
                    fd_datasync: () => 0,
                    fd_fdstat_get: () => 0,
                    fd_fdstat_set_flags: () => 0,
                    fd_fdstat_set_rights: () => 0,
                    fd_filestat_get: () => 0,
                    fd_filestat_set_size: () => 0,
                    fd_filestat_set_times: () => 0,
                    fd_pread: () => 0,
                    fd_prestat_get: () => 0,
                    fd_prestat_dir_name: () => 0,
                    fd_pwrite: () => 0,
                    fd_read: () => 0,
                    fd_readdir: () => 0,
                    fd_renumber: () => 0,
                    fd_seek: () => 0,
                    fd_sync: () => 0,
                    fd_tell: () => 0,
                    fd_write: () => 0,
                    path_create_directory: () => 0,
                    path_filestat_get: () => 0,
                    path_filestat_set_times: () => 0,
                    path_link: () => 0,
                    path_open: () => 0,
                    path_readlink: () => 0,
                    path_remove_directory: () => 0,
                    path_rename: () => 0,
                    path_symlink: () => 0,
                    path_unlink_file: () => 0,
                    poll_oneoff: () => 0,
                    proc_exit: () => 0,
                    proc_raise: () => 0,
                    random_get: () => 0,
                    sched_yield: () => 0,
                    sock_recv: () => 0,
                    sock_send: () => 0,
                    sock_shutdown: () => 0
                }
            };

            // Initialize the WebAssembly module
            const { instance } = await WebAssembly.instantiate(wasmBinary, importObject);
            this.module = instance;

            // Verify required functions are available
            const requiredFunctions = [
                this.kem.functions.keypair,
                this.kem.functions.encaps,
                this.kem.functions.decaps,
                'malloc',
                'free'
            ];

            for (const func of requiredFunctions) {
                if (typeof this.module.exports[func] !== 'function') {
                    throw new Error(`Required function ${func} not found in WebAssembly module`);
                }
            }

            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize LibOQS:', error);
            throw error;
        }
    }

    async generateKeyPair() {
        if (!this.initialized) {
            await this.init();
        }

        try {
            // Ensure 32-byte alignment for WebAssembly memory
            const publicKeyPtr = this.module.exports.malloc(this.kem.length_public_key + 32);
            const secretKeyPtr = this.module.exports.malloc(this.kem.length_secret_key + 32);

            // Align pointers to 32-byte boundaries
            const alignedPublicKeyPtr = (publicKeyPtr + 31) & ~31;
            const alignedSecretKeyPtr = (secretKeyPtr + 31) & ~31;

            // Clear memory first
            const publicKeyArray = new Uint8Array(this.module.exports.memory.buffer, alignedPublicKeyPtr, this.kem.length_public_key);
            const secretKeyArray = new Uint8Array(this.module.exports.memory.buffer, alignedSecretKeyPtr, this.kem.length_secret_key);
            
            publicKeyArray.fill(0);
            secretKeyArray.fill(0);

            // Generate the key pair using the selected variant
            const result = this.module.exports[this.kem.functions.keypair](alignedPublicKeyPtr, alignedSecretKeyPtr);
            if (result !== 0) {
                throw new Error('Failed to generate key pair');
            }

            // Get the keys and make copies before freeing memory
            const publicKey = new Uint8Array(this.kem.length_public_key);
            const secretKey = new Uint8Array(this.kem.length_secret_key);
            publicKey.set(new Uint8Array(this.module.exports.memory.buffer, alignedPublicKeyPtr, this.kem.length_public_key));
            secretKey.set(new Uint8Array(this.module.exports.memory.buffer, alignedSecretKeyPtr, this.kem.length_secret_key));

            // Obfuscate the keys
            const obfuscatedPublicKey = this.obfuscator.obfuscateBinary(publicKey);
            const obfuscatedSecretKey = this.obfuscator.obfuscateBinary(secretKey);

            // Free allocated memory
            this.module.exports.free(publicKeyPtr);
            this.module.exports.free(secretKeyPtr);

            return {
                publicKey: obfuscatedPublicKey,
                secretKey: obfuscatedSecretKey
            };
        } catch (error) {
            console.error('Error generating key pair:', error);
            throw error;
        }
    }

    async encrypt(publicKey) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            // Deobfuscate the public key
            const deobfuscatedPublicKey = this.obfuscator.deobfuscateBinary(publicKey);

            // Ensure 32-byte alignment for WebAssembly memory
            const ciphertextPtr = this.module.exports.malloc(this.kem.length_ciphertext + 32);
            const sharedSecretPtr = this.module.exports.malloc(this.kem.length_shared_secret + 32);
            const publicKeyPtr = this.module.exports.malloc(this.kem.length_public_key + 32);

            // Align pointers to 32-byte boundaries
            const alignedCiphertextPtr = (ciphertextPtr + 31) & ~31;
            const alignedSharedSecretPtr = (sharedSecretPtr + 31) & ~31;
            const alignedPublicKeyPtr = (publicKeyPtr + 31) & ~31;

            // Clear memory first
            const ciphertextArray = new Uint8Array(this.module.exports.memory.buffer, alignedCiphertextPtr, this.kem.length_ciphertext);
            const sharedSecretArray = new Uint8Array(this.module.exports.memory.buffer, alignedSharedSecretPtr, this.kem.length_shared_secret);
            const publicKeyArray = new Uint8Array(this.module.exports.memory.buffer, alignedPublicKeyPtr, this.kem.length_public_key);
            
            ciphertextArray.fill(0);
            sharedSecretArray.fill(0);
            publicKeyArray.fill(0);

            // Copy the public key to WebAssembly memory
            publicKeyArray.set(deobfuscatedPublicKey);

            // Encapsulate using the selected variant
            const result = this.module.exports[this.kem.functions.encaps](alignedCiphertextPtr, alignedSharedSecretPtr, alignedPublicKeyPtr);
            if (result !== 0) {
                throw new Error('Failed to encapsulate');
            }

            // Get the ciphertext and shared secret
            const ciphertext = new Uint8Array(this.kem.length_ciphertext);
            const sharedSecret = new Uint8Array(this.kem.length_shared_secret);
            ciphertext.set(new Uint8Array(this.module.exports.memory.buffer, alignedCiphertextPtr, this.kem.length_ciphertext));
            sharedSecret.set(new Uint8Array(this.module.exports.memory.buffer, alignedSharedSecretPtr, this.kem.length_shared_secret));

            // Verify the ciphertext and shared secret are not all zeros
            if (ciphertext.every(b => b === 0)) {
                throw new Error('Ciphertext is all zeros');
            }
            if (sharedSecret.every(b => b === 0)) {
                throw new Error('Shared secret is all zeros');
            }

            // Free allocated memory
            this.module.exports.free(ciphertextPtr);
            this.module.exports.free(sharedSecretPtr);
            this.module.exports.free(publicKeyPtr);

            // Return the raw ciphertext and shared secret
            return {
                ciphertext: ciphertext,
                sharedSecret: sharedSecret
            };
        } catch (error) {
            console.error('Error during encryption:', error);
            throw error;
        }
    }

    async decrypt(ciphertext, secretKey) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            // Deobfuscate the secret key
            const deobfuscatedSecretKey = this.obfuscator.deobfuscateBinary(secretKey);

            // Ensure 32-byte alignment for WebAssembly memory
            const sharedSecretPtr = this.module.exports.malloc(this.kem.length_shared_secret + 32);
            const ciphertextPtr = this.module.exports.malloc(this.kem.length_ciphertext + 32);
            const secretKeyPtr = this.module.exports.malloc(this.kem.length_secret_key + 32);

            // Align pointers to 32-byte boundaries
            const alignedSharedSecretPtr = (sharedSecretPtr + 31) & ~31;
            const alignedCiphertextPtr = (ciphertextPtr + 31) & ~31;
            const alignedSecretKeyPtr = (secretKeyPtr + 31) & ~31;

            // Clear memory first
            const sharedSecretArray = new Uint8Array(this.module.exports.memory.buffer, alignedSharedSecretPtr, this.kem.length_shared_secret);
            const ciphertextArray = new Uint8Array(this.module.exports.memory.buffer, alignedCiphertextPtr, this.kem.length_ciphertext);
            const secretKeyArray = new Uint8Array(this.module.exports.memory.buffer, alignedSecretKeyPtr, this.kem.length_secret_key);
            
            sharedSecretArray.fill(0);
            ciphertextArray.fill(0);
            secretKeyArray.fill(0);

            // Copy the ciphertext and secret key to WebAssembly memory
            ciphertextArray.set(ciphertext);
            secretKeyArray.set(deobfuscatedSecretKey);

            // Decapsulate using the selected variant
            const result = this.module.exports[this.kem.functions.decaps](alignedSharedSecretPtr, alignedCiphertextPtr, alignedSecretKeyPtr);
            if (result !== 0) {
                throw new Error('Failed to decapsulate');
            }

            // Get the shared secret
            const sharedSecret = new Uint8Array(this.kem.length_shared_secret);
            sharedSecret.set(new Uint8Array(this.module.exports.memory.buffer, alignedSharedSecretPtr, this.kem.length_shared_secret));

            // Verify the shared secret is not all zeros
            if (sharedSecret.every(b => b === 0)) {
                throw new Error('Shared secret is all zeros');
            }

            // Free allocated memory
            this.module.exports.free(sharedSecretPtr);
            this.module.exports.free(ciphertextPtr);
            this.module.exports.free(secretKeyPtr);

            // Return the shared secret directly
            return sharedSecret;
        } catch (error) {
            console.error('Error during decryption:', error);
            throw error;
        }
    }

    // Add a new method to handle file content encryption
    // Update encryptFileContent method to include header
async encryptFileContent(content) {
    try {
        this.updateProgress(0, 4, 'Generating key pair...');
        const { publicKey, secretKey } = await this.generateKeyPair();

        this.updateProgress(1, 4, 'Encrypting with Kyber KEM...');
        const { ciphertext, sharedSecret } = await this.encrypt(publicKey);

        this.updateProgress(2, 4, 'Encrypting file content...');
        // Prepend 32-byte header filled with zeros
        const contentWithHeader = new Uint8Array(32 + content.length);
        contentWithHeader.fill(0);
        contentWithHeader.set(content, 32);
        const encryptedContent = this.xorData(contentWithHeader, sharedSecret);

        this.updateProgress(3, 4, 'Finalizing encryption...');
        await new Promise(resolve => setTimeout(resolve, 100));

        this.updateProgress(4, 4, 'Encryption complete!');

        return {
            ciphertext,
            encryptedContent,
            secretKey
        };
    } catch (error) {
        console.error('Error encrypting file content:', error);
        throw error;
    }
}

// Update decryptFileContent method to validate header
async decryptFileContent(ciphertext, encryptedContent, secretKey) {
    try {
        this.updateProgress(0, 3, 'Decrypting with Kyber KEM...');
        const sharedSecret = await this.decrypt(ciphertext, secretKey);

        this.updateProgress(1, 3, 'Decrypting file content...');
        const decryptedContent = this.xorData(encryptedContent, sharedSecret);

        // Check the first 32 bytes (header) are zeros
        const header = decryptedContent.slice(0, 32);
        if (header.some(byte => byte !== 0)) {
            throw new Error('Invalid key: Decryption failed. Please use the correct key file.');
        }

        // Remove the header
        const actualContent = decryptedContent.slice(32);

        this.updateProgress(2, 3, 'Finalizing decryption...');
        await new Promise(resolve => setTimeout(resolve, 100));

        this.updateProgress(3, 3, 'Decryption complete!');

        return actualContent;
    } catch (error) {
        console.error('Error decrypting file content:', error);
        throw error;
    }
}
    // Helper method to XOR data with a key
    xorData(data, key) {
        const result = new Uint8Array(data.length);
        const chunkSize = 1024 * 1024; // Process 1MB at a time
        const totalChunks = Math.ceil(data.length / chunkSize);

        // Create a key buffer that's the same size as the data
        const keyBuffer = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) {
            keyBuffer[i] = key[i % key.length];
        }

        for (let chunk = 0; chunk < totalChunks; chunk++) {
            const start = chunk * chunkSize;
            const end = Math.min(start + chunkSize, data.length);
            
            for (let i = start; i < end; i++) {
                result[i] = data[i] ^ keyBuffer[i];
            }

            // Update progress for large files
            if (totalChunks > 1) {
                this.updateProgress(chunk, totalChunks, `Processing file chunk ${chunk + 1}/${totalChunks}...`);
            }
        }

        return result;
    }
}

export default LibOQS; 