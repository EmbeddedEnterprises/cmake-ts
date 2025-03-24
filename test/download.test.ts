import { suite, expect, beforeEach, afterEach, test, beforeAll } from 'vitest';
import { downloadToString, downloadFile, downloadTgz, downloadZip, calculateHash } from '../src/download';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const dirname = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(dirname)

const testTmpDir = path.join(root, "test", ".tmp");

suite('Download Module', () => {
    // Real Node.js distribution URLs for testing
    const nodeBaseUrl = 'https://nodejs.org/dist/v23.4.0';
    const nodeHeadersUrl = `${nodeBaseUrl}/node-v23.4.0-headers.tar.gz`;
    const nodeDocsUrl = `${nodeBaseUrl}/docs/apilinks.json`;
    const nodeWinZipUrl = `${nodeBaseUrl}/node-v23.4.0-win-x64.zip`;
    const nodeShasumUrl = `${nodeBaseUrl}/SHASUMS256.txt`;

    beforeAll(async () => {
        await fs.remove(testTmpDir);
        await fs.ensureDir(testTmpDir);
    });

    suite('downloadToString', () => {
        test('should download Node.js SHASUMS as a string', async () => {
            const content = await downloadToString(nodeShasumUrl);
            expect(content).toBeTruthy();
            expect(content).toContain('node-v23.4.0');
        });

        test('should download Node.js API docs as a string', async () => {
            const content = await downloadToString(nodeDocsUrl);
            expect(content).toBeTruthy();
            expect(JSON.parse(content)).toHaveProperty('fs.readFileSync');
        });

        test('should throw an error for non-existent files', async () => {
            await expect(() => downloadToString(`${nodeBaseUrl}/nonexistent.txt`, { timeout: 100 })).rejects.toThrow();
        });
    });

    suite('downloadFile', () => {
        test('should download Node.js SHASUMS to a file', async () => {
            const targetPath = path.join(testTmpDir, 'SHASUMS256.txt');
            await downloadFile(nodeShasumUrl, { path: targetPath });

            const exists = await fs.pathExists(targetPath);
            expect(exists).toBe(true);

            const content = await fs.readFile(targetPath, 'utf8');
            expect(content).toContain('node-v23.4.0');
        });

        test('should download Node.js API docs to a file', async () => {
            const targetPath = path.join(testTmpDir, 'apilinks.json');
            await downloadFile(nodeDocsUrl, { path: targetPath });

            const exists = await fs.pathExists(targetPath);
            expect(exists).toBe(true);

            const content = await fs.readFile(targetPath, 'utf8');
            expect(JSON.parse(content)).toHaveProperty('fs.readFileSync');
        });

        test('should download a file with hash verification', async () => {
            // First download the file to calculate its hash
            const tempPath = path.join(testTmpDir, 'temp-shasums.txt');
            await downloadFile(nodeShasumUrl, { path: tempPath });
            const hash = await calculateHash(tempPath, 'sha256');

            // Now download with hash verification
            const targetPath = path.join(testTmpDir, 'verified-shasums.txt');
            const result = await downloadFile(nodeShasumUrl, {
                path: targetPath,
                hashType: 'sha256',
                hashSum: hash
            });

            expect(result).toBe(hash);

            const exists = await fs.pathExists(targetPath);
            expect(exists).toBe(true);
        });

        test('should throw an error if hash verification fails', async () => {
            const targetPath = path.join(testTmpDir, 'hash-fail.txt');

            await expect(downloadFile(nodeShasumUrl, {
                path: targetPath,
                hashType: 'sha256',
                hashSum: 'invalid-hash'
            })).rejects.toThrow('Checksum mismatch');
        });
    });

    suite('downloadTgz', () => {
        test('should download and extract Node.js headers tar.gz file', async () => {
            const extractPath = path.join(testTmpDir, 'node-headers');
            await fs.ensureDir(extractPath);

            await downloadTgz(nodeHeadersUrl, { path: extractPath });

            // Check if files were extracted
            const files = await fs.readdir(extractPath);
            expect(files.length).toBeGreaterThan(0);

            // Verify specific files that should be in the Node.js headers package
            const nodeDir = path.join(extractPath, 'node-v23.4.0');
            expect(await fs.pathExists(nodeDir)).toBe(true);

            // Check for include directory
            const includeDir = path.join(nodeDir, 'include');
            expect(await fs.pathExists(includeDir)).toBe(true);

            // Check for node.h file
            const nodeHeaderFile = path.join(includeDir, 'node', 'node.h');
            expect(await fs.pathExists(nodeHeaderFile)).toBe(true);
        });

        test('should support strip option for Node.js headers tar.gz file', async () => {
            const extractPath = path.join(testTmpDir, 'node-headers-strip');
            await fs.ensureDir(extractPath);

            await downloadTgz(nodeHeadersUrl, {
                path: extractPath,
                strip: 1
            });

            // With strip=1, the node-v23.4.0 directory should be stripped
            // and the contents should be directly in the extract path
            const includeDir = path.join(extractPath, 'include');
            expect(await fs.pathExists(includeDir)).toBe(true);

            // Check for node.h file
            const nodeHeaderFile = path.join(includeDir, 'node', 'node.h');
            expect(await fs.pathExists(nodeHeaderFile)).toBe(true);
        });
    });

    suite('downloadZip', () => {
        test('should download and extract Node.js Windows zip file', async function () {
            const extractPath = path.join(testTmpDir, 'extracted-zip');
            await fs.ensureDir(extractPath);

            await downloadZip(nodeWinZipUrl, { path: extractPath });

            // Check if files were extracted
            const files = await fs.readdir(extractPath);
            expect(files.length).toBeGreaterThan(0);

            // Verify specific files that should be in the Node.js Windows package
            expect(await fs.pathExists(path.join(extractPath, 'node.exe'))).toBe(true);
            expect(await fs.pathExists(path.join(extractPath, 'npm.cmd'))).toBe(true);
            expect(await fs.pathExists(path.join(extractPath, 'LICENSE'))).toBe(true);
        });

        test('should download and extract Node.js Windows zip file with options', async function () {
            const extractPath = path.join(testTmpDir, 'extracted-zip-with-options');
            await fs.ensureDir(extractPath);

            // First download to calculate hash
            const tempPath = path.join(testTmpDir, 'temp-node.zip');
            await downloadFile(nodeWinZipUrl, { path: tempPath });
            const hash = await calculateHash(tempPath, 'sha256');

            // Now download with hash verification
            const result = await downloadZip(nodeWinZipUrl, {
                path: extractPath,
                hashType: 'sha256',
                hashSum: hash
            });

            expect(result).toBe(hash);

            // Verify extraction worked
            expect(await fs.pathExists(path.join(extractPath, 'node.exe'))).toBe(true);
        });
    });
});
