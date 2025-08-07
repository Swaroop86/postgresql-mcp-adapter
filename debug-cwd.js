#!/usr/bin/env node

// debug-cwd.js - Script to debug working directory issues

import fs from 'fs';
import path from 'path';

console.log('=== Working Directory Debug Info ===');
console.log(`Current Working Directory: ${process.cwd()}`);
console.log(`Script Location: ${import.meta.url}`);
console.log(`Process Arguments: ${process.argv.join(' ')}`);
console.log(`Platform: ${process.platform}`);
console.log(`Node Version: ${process.version}`);

console.log('\n=== Environment Variables ===');
console.log(`HOME: ${process.env.HOME}`);
console.log(`PWD: ${process.env.PWD}`);
console.log(`USER: ${process.env.USER}`);
console.log(`CURSOR_PROJECT_PATH: ${process.env.CURSOR_PROJECT_PATH || 'not set'}`);
console.log(`PROJECT_PATH: ${process.env.PROJECT_PATH || 'not set'}`);

console.log('\n=== Directory Contents ===');
const cwd = process.cwd();
try {
  const files = fs.readdirSync(cwd);
  console.log(`Files in ${cwd}:`);
  files.slice(0, 10).forEach(file => {
    const stat = fs.statSync(path.join(cwd, file));
    console.log(`  ${file} ${stat.isDirectory() ? '(dir)' : '(file)'}`);
  });
  if (files.length > 10) {
    console.log(`  ... and ${files.length - 10} more`);
  }
} catch (error) {
  console.log(`Error reading directory: ${error.message}`);
}

console.log('\n=== Project Detection ===');
const projectMarkers = ['pom.xml', 'build.gradle', 'package.json', 'src/main/java', '.git'];
let foundMarkers = [];

projectMarkers.forEach(marker => {
  const markerPath = path.join(cwd, marker);
  if (fs.existsSync(markerPath)) {
    foundMarkers.push(marker);
  }
});

if (foundMarkers.length > 0) {
  console.log('✅ This appears to be a project directory');
  console.log(`Found markers: ${foundMarkers.join(', ')}`);
} else {
  console.log('❌ No project markers found in current directory');
  console.log('Searching parent directories...');
  
  let searchDir = cwd;
  let found = false;
  
  for (let i = 0; i < 5; i++) {
    const parentDir = path.dirname(searchDir);
    if (parentDir === searchDir) break;
    
    for (const marker of projectMarkers) {
      if (fs.existsSync(path.join(parentDir, marker))) {
        console.log(`✅ Found project marker '${marker}' in: ${parentDir}`);
        found = true;
        break;
      }
    }
    
    if (found) break;
    searchDir = parentDir;
  }
}