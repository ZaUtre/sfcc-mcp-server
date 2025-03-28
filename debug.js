// debug.js
import { z } from "zod";
import { config } from "dotenv";

// Load environment variables
config();

console.error("Script starting...");

// Simple test handler
async function handleWeatherRequest(location) {
  console.error("Weather tool called with location:", location);
  
  // Mock implementation
  const weatherConditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Stormy", "Snowy", "Windy"];
  const randomCondition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
  const temperature = Math.floor(Math.random() * 35) + 5; // Random temp between 5-40°C
  
  return {
    type: "response",
    id: "test-response",
    content: [
      {
        type: "text",
        text: `Weather for ${location}:\nCondition: ${randomCondition}\nTemperature: ${temperature}°C`,
      },
    ],
  };
}

async function main() {
  console.error("Debug server running...");
  
  // Process stdin
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', async (data) => {
    console.error("DEBUG Received stdin data:", data.toString().trim());
    
    try {
      const request = JSON.parse(data.toString().trim());
      console.error("Parsed request:", JSON.stringify(request, null, 2));
      
      if (request.type === "request") {
        let response;
        
        if (request.toolId === "get-weather") {
          response = await handleWeatherRequest(request.toolInput.location);
        } else if (request.toolId === "get-product-by-id") {
          response = {
            type: "response",
            id: request.id,
            content: [
              {
                type: "text",
                text: `Product: Sample Product\nID: ${request.toolInput.id}\nBrand: SampleBrand\nPrice: 19.99 USD\nIn Stock: Yes\nDescription: This is a sample product description for ID ${request.toolInput.id}`,
              },
            ],
          };
        } else {
          response = {
            type: "response",
            id: request.id,
            content: [
              {
                type: "text",
                text: `Unknown tool: ${request.toolId}`,
              },
            ],
          };
        }
        
        // Send response
        console.error("Sending response:", JSON.stringify(response, null, 2));
        console.log(JSON.stringify(response));
      }
    } catch (error) {
      console.error("ERROR processing request:", error);
    }
  });
  
  // Keep the process alive
  setInterval(() => {}, 1000);
}

console.error("Calling main()...");
main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});