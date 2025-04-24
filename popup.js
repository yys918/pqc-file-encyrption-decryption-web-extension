// popup.js
import LibOQS from './liboqs-wrapper.js';

document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('fileInput');
    const encryptBtn = document.getElementById('encryptBtn');
    const encryptStatus = document.getElementById('encryptStatus');
    const encryptedFileInput = document.getElementById('encryptedFileInput');
    const keyFileInput = document.getElementById('keyFileInput');
    const decryptBtn = document.getElementById('decryptBtn');
    const decryptStatus = document.getElementById('decryptStatus');

    // Initialize LibOQS with Kyber-768
    const liboqs = new LibOQS();
    await liboqs.init();

    // Update progress bar function to use existing elements
    function updateProgressBar(step, total, message) {
        const progressBar = document.querySelector('.progress-bar');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (!progressBar || !progressFill || !progressText) {
            console.warn('Progress bar elements not found');
            return;
        }
        
        const percentage = (step / total) * 100;
        
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = message;
        
        if (step === 0) {
            progressBar.parentElement.style.display = 'block';
        } else if (step === total) {
            setTimeout(() => {
                progressBar.parentElement.style.display = 'none';
                progressFill.style.width = '0%';
            }, 1000);
        }
    }

    // Set up progress callback immediately after creating liboqs instance
    liboqs.setProgressCallback(updateProgressBar);

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            console.log('Starting encryption process for file:', file.name, 'size:', file.size);
            updateProgressBar(0, 4, 'Starting encryption...');
            
            // Read the file content
            const arrayBuffer = await file.arrayBuffer();
            const fileData = new Uint8Array(arrayBuffer);
            console.log('File read complete, size:', fileData.length);
            console.log('Original file first 100 bytes:', Array.from(fileData.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(''));

            // Encrypt the file content using liboqs
            const { ciphertext, encryptedContent, secretKey } = await liboqs.encryptFileContent(fileData);
            console.log('Encryption result:', {
                ciphertextLength: ciphertext.length,
                encryptedContentLength: encryptedContent.length,
                secretKeyLength: secretKey.length
            });

            // Combine ciphertext and encrypted content
            const encryptedData = new Uint8Array(ciphertext.length + encryptedContent.length);
            encryptedData.set(ciphertext);
            encryptedData.set(encryptedContent, ciphertext.length);

            console.log('Encryption complete, creating files...');
            updateProgressBar(4, 4, 'Creating files...');

            // Create and download encrypted file
            const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });
            const encryptedUrl = URL.createObjectURL(encryptedBlob);
            const encryptedLink = document.createElement('a');
            encryptedLink.href = encryptedUrl;
            encryptedLink.download = `${file.name}.encrypted`;
            encryptedLink.click();
            URL.revokeObjectURL(encryptedUrl);

            // Create and download key file
            const keyBlob = new Blob([secretKey], { type: 'application/octet-stream' });
            const keyUrl = URL.createObjectURL(keyBlob);
            const keyLink = document.createElement('a');
            keyLink.href = keyUrl;
            keyLink.download = `${file.name}.key`;
            keyLink.click();
            URL.revokeObjectURL(keyUrl);

            // Store the ciphertext and secret key in localStorage
            try {
                localStorage.setItem('last_ciphertext', JSON.stringify(Array.from(ciphertext)));
                localStorage.setItem('last_secret_key', JSON.stringify(Array.from(secretKey)));
            } catch (error) {
                console.warn('Could not store keys in localStorage:', error);
            }

            updateProgressBar(4, 4, 'Encryption complete!');
            encryptStatus.textContent = 'File encrypted successfully!';
            encryptStatus.className = 'status success';
        } catch (error) {
            console.error('Error encrypting file:', error);
            console.error('Error stack:', error.stack);
            encryptStatus.textContent = 'Error encrypting file: ' + error.message;
            encryptStatus.className = 'status error';
        }
    });

    decryptBtn.addEventListener('click', async () => {
        const encryptedFile = encryptedFileInput.files[0];
        const keyFile = keyFileInput.files[0];

        if (!encryptedFile || !keyFile) {
            decryptStatus.textContent = 'Please select both encrypted file and key file';
            decryptStatus.className = 'status error';
            return;
        }

        try {
            console.log('Starting decryption process for file:', encryptedFile.name, 'size:', encryptedFile.size);
            updateProgressBar(0, 3, 'Starting decryption...');

            // Read the encrypted file
            const encryptedArrayBuffer = await encryptedFile.arrayBuffer();
            const encryptedData = new Uint8Array(encryptedArrayBuffer);
            console.log('Encrypted file read complete, size:', encryptedData.length);

            // Read the key file
            const keyArrayBuffer = await keyFile.arrayBuffer();
            const secretKey = new Uint8Array(keyArrayBuffer);

            // Verify key size
            const actualKeyLength = secretKey.length - 32; // Account for obfuscation key
            if (actualKeyLength !== liboqs.kem.length_secret_key) {
                decryptStatus.textContent = 'Error: Invalid key file size. Please use the correct key file.';
                decryptStatus.className = 'status error';
                return;
            }

            // Split the encrypted data into ciphertext and encrypted content
            const ciphertext = encryptedData.slice(0, liboqs.kem.length_ciphertext);
            const encryptedContent = encryptedData.slice(liboqs.kem.length_ciphertext);

            // Verify ciphertext size
            if (ciphertext.length !== liboqs.kem.length_ciphertext) {
                decryptStatus.textContent = 'Error: Invalid encrypted file format. Please use the correct encrypted file.';
                decryptStatus.className = 'status error';
                return;
            }

            console.log('Encrypted file:', {
                totalSize: encryptedData.length,
                ciphertextSize: ciphertext.length,
                encryptedContentSize: encryptedContent.length
            });

            console.log('Key file:', {
                size: actualKeyLength,
                expectedSize: liboqs.kem.length_secret_key
            });

            updateProgressBar(1, 3, 'Decrypting...');

            // Decrypt the file content using liboqs.decryptFileContent
            const decryptedData = await liboqs.decryptFileContent(ciphertext, encryptedContent, secretKey);

            console.log('Decryption complete, creating file...');
            updateProgressBar(3, 3, 'Creating file...');

            // Create and download decrypted file
            const decryptedBlob = new Blob([decryptedData], { type: 'application/octet-stream' });
            const decryptedUrl = URL.createObjectURL(decryptedBlob);
            const decryptedLink = document.createElement('a');
            decryptedLink.href = decryptedUrl;
            decryptedLink.download = encryptedFile.name.replace('.encrypted', '');
            decryptedLink.click();
            URL.revokeObjectURL(decryptedUrl);

            updateProgressBar(3, 3, 'Decryption complete!');
            decryptStatus.textContent = 'File decrypted successfully!';
            decryptStatus.className = 'status success';
        } catch (error) {
            console.error('Error decrypting file:', error);
            console.error('Error stack:', error.stack);
            decryptStatus.textContent = error.message || 'Error decrypting file: Invalid key or corrupted file';
            decryptStatus.className = 'status error';
        }
    });
});