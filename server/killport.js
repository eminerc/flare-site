#!/usr/bin/env node

const { exec } = require('child_process');

const port = process.argv[2] || 5000;

console.log(`Looking for processes on port ${port}...`);

// For macOS/Linux
const command = `lsof -ti:${port} | xargs kill -9`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.log(`No processes found on port ${port} or already killed.`);
    return;
  }
  
  if (stderr) {
    console.error('Error:', stderr);
    return;
  }
  
  console.log(`✅ Killed processes on port ${port}`);
});

// Alternative method using netstat for cross-platform compatibility
const alternativeCommand = process.platform === 'win32' 
  ? `netstat -ano | findstr :${port}` 
  : `netstat -tulpn | grep :${port}`;

exec(alternativeCommand, (error, stdout, stderr) => {
  if (stdout) {
    console.log('Processes found:');
    console.log(stdout);
  }
});