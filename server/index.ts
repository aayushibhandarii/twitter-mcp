import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import z from "zod";

import createPost  from './mcp-tool.js';

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {

  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  let transport: StreamableHTTPServerTransport;
  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];

  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        // Store the transport by session ID
        transports[sessionId] = transport;
      },
      // DNS rebinding protection is disabled by default for backwards compatibility. If you are running this server
      // locally, make sure to set:
      // enableDnsRebindingProtection: true,
      // allowedHosts: ['127.0.0.1'],
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };
    const server = new McpServer({
      name: "example-server",
      version: "1.0.0"
    }); // creating a server

    // ... set up server resources, tools, and prompts ...
    server.tool(
        "addTwoNumbers", //tool name
        "To add two numbers", //tool description
        { //tool arguments
            a :  z.number(),
            b : z.number()
        },
        async ({a,b})=>{
            return {
                content : [
                    {
                        type:"text",
                        text :`Addition of two numbers ${a} and ${b} is ${a+b}`
                    }
                ]
            }
        }
    );//tool to add two numbers 

    server.tool(
      "createPost", // name of the tool

      "creates a post in twitter with hashtags", // Description =>if putting the tool in ai -> it gives instruction to the ai about what this tool does and how to do it.... with hashtags will make ai generate hashtag also for the post

      { post: z.string() }, //post is what we're going to post on twitter

      async ({ post }) => {
        const result = await createPost(post);
        return {
                content : [
                    {
                        type:"text",
                        text :`${result.content[0].text}`
                    }
                ]
        }
      }
    );
    // Connect to the MCP server
    await server.connect(transport);
    
  } else {
    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

app.listen(3000);