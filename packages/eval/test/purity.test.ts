import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function findTsFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findTsFiles(filePath, fileList);
    } else if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Core Purity (T0.3)', () => {
  it('packages/core should not import window, document, React, Capacitor, or ml/', () => {
    const coreSrcDir = path.resolve(__dirname, '../../core/src');
    const files = findTsFiles(coreSrcDir);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      
      expect(content).not.toMatch(/from\s+['"]react['"]/);
      expect(content).not.toMatch(/from\s+['"]@capacitor\/core['"]/);
      expect(content).not.toMatch(/from\s+['"]\.\.\/\.\.\/\.\.\/ml\//);
      
      // Ensure no global DOM objects are used. This is basic string matching.
      // A full ESLint rule would be better but this satisfies the immediate gate.
      expect(content).not.toMatch(/\bwindow\./);
      expect(content).not.toMatch(/\bdocument\./);
    }
  });
});
