// Debug version that manually handles input/output
import { exec } from 'child_process';

// Catalogs request
const catalogsRequest = {
  type: "request",
  id: "125",
  toolId: "get-catalogs",
  toolInput: {}
};

const requestStr = JSON.stringify(catalogsRequest);

// Run the command with input piped to it
const cmd = `echo '${requestStr}' | node mock-server.js`;
console.log(`Executing: ${cmd}`);

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Debug output: ${stderr}`);
  }
  console.log(`Response: ${stdout}`);
});