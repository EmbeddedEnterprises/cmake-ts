import { suite, expect, test, beforeEach } from 'vitest';
import { downloadToString, downloadFile, downloadTgz, calculateHash } from '../src/download';
import * as fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';

const dirname = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(dirname)

const testTmpDir = path.join(root, "test", ".tmp");

suite('Download Module', { timeout: 20_000 }, () => {
    // Real Node.js distribution URLs for testing
    const nodeBaseUrl = 'https://nodejs.org/dist/v23.4.0';
    const nodeHeadersUrl = `${nodeBaseUrl}/node-v23.4.0-headers.tar.gz`;
    const nodeDocsUrl = `${nodeBaseUrl}/docs/apilinks.json`;
    const nodeShasumUrl = `${nodeBaseUrl}/SHASUMS256.txt`;

    beforeEach(async () => {
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

        test.fails('should throw an error for non-existent files', async () => {
            await downloadToString(`${nodeBaseUrl}/nonexistent.txt`, { timeout: 100 })
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

            await downloadTgz(nodeHeadersUrl, { extractOptions: { cwd: extractPath } });

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
                extractOptions: {
                    strip: 1,
                    cwd: extractPath,
                }
            });

            // With strip=1, the node-v23.4.0 directory should be stripped
            // and the contents should be directly in the extract path
            const includeDir = path.join(extractPath, 'include');
            expect(await fs.pathExists(includeDir)).toBe(true);

            // Check for node.h file
            const nodeHeaderFile = path.join(includeDir, 'node', 'node.h');
            expect(await fs.pathExists(nodeHeaderFile)).toBe(true);
        });

        test('should verify the hash of the downloaded file', async () => {
            const extractPath = path.join(testTmpDir, 'node-headers');
            await fs.ensureDir(extractPath);

            const shasum = await downloadToString(nodeShasumUrl);
            const hashSums = parseSHASUM(shasum);
            const nodeHeadersHash = hashSums.find(h => h.file === 'node-v23.4.0-headers.tar.gz')?.hash;
            expect(nodeHeadersHash).toBeDefined();

            const downloadPath = path.join(testTmpDir, 'node-headers.tar.gz');
            await downloadTgz(nodeHeadersUrl, {
                path: downloadPath,
                hashSum: nodeHeadersHash,
                removeAfterExtract: false,
                extractOptions: { cwd: extractPath }
            });

            expect(await fs.pathExists(downloadPath)).toBe(true);
            expect(await fs.pathExists(path.join(extractPath, 'node-v23.4.0'))).toBe(true);


            const hash = await calculateHash(downloadPath, 'sha256');
            expect(hash).toBe(nodeHeadersHash);
        });
    });
});


type HashSum = { hash: string, file: string };

function parseSHASUM(content: string): HashSum[] {
    const lines = content.split('\n');
    return lines.map(line => {
        const [hash, file] = line.split('  ');
        return { hash, file };
    });
}
