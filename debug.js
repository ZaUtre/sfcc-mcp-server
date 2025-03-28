// debug.js - A simple script to forward stdin to the MCP server and print both request and response
import { spawn } from 'child_process';
import fs from 'fs';

// Read the incoming request from stdin
let requestData = '';
process.stdin.on('data', chunk => {
  requestData += chunk;
});

process.stdin.on('end', () => {
  try {
    // Parse the request to log it
    const requestObj = JSON.parse(requestData);
    console.error("Request received:", JSON.stringify(requestObj, null, 2));
    
    // Pass the request to the MCP server
    const serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Send the request to the server
    serverProcess.stdin.write(requestData);
    serverProcess.stdin.end();
    
    let stdoutData = '';
    let stderrData = '';
    
    // Collect stdout data
    serverProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });
    
    // Collect stderr data
    serverProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
      // Also log stderr in real time
      console.error("Server log:", data.toString().trim());
    });
    
    // Handle process exit
    serverProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Server process exited with code ${code}`);
      }
      
      // Print collected stderr if any
      if (stderrData) {
        console.error("All server logs:", stderrData);
      }
      
      // Try to parse stdout as JSON
      if (stdoutData) {
        try {
          const responseObj = JSON.parse(stdoutData);
          console.error("Response (parsed):", JSON.stringify(responseObj, null, 2));
        } catch (e) {
          console.error("Could not parse response as JSON:", e.message);
          console.error("Raw stdout:", stdoutData);
        }
        
        // Pass the response to the caller
        console.log(stdoutData);
      } else {
        console.error("No response from server");
      }
    });
    
  } catch (error) {
    console.error("Error in debug script:", error);
  }
});