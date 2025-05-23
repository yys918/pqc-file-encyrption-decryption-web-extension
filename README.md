# Post-Quantum File Encryptor Chrome Extension

A Chrome-based extension that allows users to encrypt and decrypt files using post-quantum cryptography.

## Features

- File encryption using post-quantum cryptography
- Secure key generation and management
- Simple and intuitive user interface
- Support for any file type
- Automatic file download after encryption/decryption

## Installation

1. Clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory. *Only the folder that contains the files
5. The extension icon should appear in your Chrome toolbar

## Usage

### Encrypting a File

1. Click the extension icon in your Chrome toolbar
2. Select which kyber variant to be used
3. Go to the "Encrypt" tab
4. Click "Choose File" and select the file you want to encrypt
5. Click "Encrypt File"
6. Two files will be downloaded:
   - The encrypted file (with .encrypted extension)
   - The shared key (with .key extension)

### Decrypting a File

1. Click the extension icon in your Chrome toolbar
2. Select the "Decrypt" tab
3. Upload both the encrypted file and the corresponding shared key
4. Click "Decrypt File"
5. The decrypted file will be downloaded with its original name

## Security Notes

- Keep your shared keys secure and never share them with unauthorized parties
- The extension uses the Kyber algorithm, which is a post-quantum cryptographic algorithm selected by NIST
- All encryption/decryption operations are performed locally in your browser
- No data is sent to any external servers
