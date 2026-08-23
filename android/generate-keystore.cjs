#!/usr/bin/env node

/**
 * Generate Android Release Keystore
 * Works on Windows, macOS, and Linux
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const keystorePath = path.join(__dirname, 'app', 'rutiini-release.jks');
const keystorePropsPath = path.join(__dirname, 'keystore.properties');

console.log('\n=== Android Release Keystore Generator ===\n');

// Check if keystore already exists
if (fs.existsSync(keystorePath)) {
    console.log('✓ Keystore already exists:', keystorePath);
    if (fs.existsSync(keystorePropsPath)) {
        console.log('✓ keystore.properties already exists');
        process.exit(0);
    }
} else {
    console.log('Generating new keystore...');
    
    try {
        const javaHome = process.env.JAVA_HOME || 'java';
        const keytoolPath = process.platform === 'win32' 
            ? path.join(javaHome, 'bin', 'keytool.exe')
            : 'keytool';
        
        const cmd = `"${keytoolPath}" -genkey -v -keystore "${keystorePath}" -keyalg RSA -keysize 2048 -validity 10000 -alias rutiini-key -storepass rutiini2024 -keypass rutiini2024 -dname "CN=Rutiini, OU=Daycare, O=Rutiini, L=Finland, S=Finland, C=FI"`;
        
        console.log('Running keytool...');
        execSync(cmd, { stdio: 'inherit', shell: true });
        console.log('✓ Keystore generated successfully!');
    } catch (error) {
        console.error('✗ Failed to generate keystore:', error.message);
        console.error('\nMake sure Java/Android Studio is installed and JAVA_HOME is set correctly.');
        process.exit(1);
    }
}

// Create keystore.properties
console.log('\nCreating keystore.properties...');
const keystoreProps = `storeFile=app/rutiini-release.jks
storePassword=rutiini2024
keyAlias=rutiini-key
keyPassword=rutiini2024
`;

try {
    fs.writeFileSync(keystorePropsPath, keystoreProps);
    console.log('✓ keystore.properties created successfully!');
} catch (error) {
    console.error('✗ Failed to create keystore.properties:', error.message);
    process.exit(1);
}

console.log('\n=== Keystore Ready ===\n');
