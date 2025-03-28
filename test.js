import { spawn } from 'child_process';

// Start the MCP server process
const serverProcess = spawn('node', ['build/index.js']);

// Log any server error output for debugging
serverProcess.stderr.on('data', (data) => {
  console.error(`Server stderr: ${data}`);
});

// Sample request for the weather tool
const weatherRequest = {
  type: "request",
  id: "123",
  toolId: "get-weather",
  toolInput: { location: "San Francisco" }
};

// Set a flag to track if product request was sent
let productRequestSent = false;

// Handle server responses
serverProcess.stdout.on('data', (data) => {
  console.log(`Server response: ${data.toString()}`);
  
  // After receiving a response to the weather request, try the product request
  if (!productRequestSent) {
    console.log('Sending product request...');
    const productRequest = {
      type: "request", 
      id: "124",
      toolId: "get-product-by-id",
      toolInput: { id: "5" }
    };
    
    // Send product request
    serverProcess.stdin.write(JSON.stringify(productRequest) + '\n');
    productRequestSent = true;
  }
});

// Write the weather request to the server's stdin
console.log('Sending weather request...');
serverProcess.stdin.write(JSON.stringify(weatherRequest) + '\n');

// Keep process running for a bit to let the responses come back
setTimeout(() => {
  console.log('Ending test');
  serverProcess.kill();
  process.exit(0);
}, 10000);