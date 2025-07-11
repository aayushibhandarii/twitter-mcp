import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
const app = express();
app.use(express.json());
const server = new McpServer({
    name: "example-server",
    version: "1.0.0"
});
const transports = {};
//client to server communication
app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID()
    });
    await server.connect(transport);
    await transport.handleRequest(req, res);
});
server.tool("addTwoNumbers", "To add two numbers", {
    a: z.number(),
    b: z.number()
}, async ({ a, b }) => {
    return {
        content: [
            {
                type: "text",
                text: `Sum of number ${a} and ${b} is ${a + b}`
            }
        ]
    };
});
server.tool("multiplyTwoNumbers", "To multiply two numbers", {
    a: z.number(),
    b: z.number()
}, async ({ a, b }) => {
    return {
        content: [
            {
                type: "text",
                text: `Multiplication of number ${a} and ${b} is ${a * b}`
            }
        ]
    };
});
app.listen(3000, () => { console.log("Server is listening on port 3000"); });
