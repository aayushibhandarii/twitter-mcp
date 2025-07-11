import { GoogleGenAI } from "@google/genai";
import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {StreamableHTTPClientTransport} from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import readline from "readline/promises";

import dotenv from "dotenv";
dotenv.config();

//gemini
const GEMINI_API_KEY=process.env.GEMINI_API_KEY;
if(!GEMINI_API_KEY){
    throw new Error("GEMINI_API_KEY is not set");
}
const ai  = new GoogleGenAI({
    apiKey:GEMINI_API_KEY
});

//stores the message history -> act as the context for the ai
const messages:{role : string,parts :{text :string}[]}[] = [];

const mcpClient : Client = new Client({
        name:"twitter-client",
        version : "1.0.0"
}); //creating an mcp client

const baseUrl = "http://localhost:3000/mcp"; //it is the route we put in server/index.js
await mcpClient.connect(new StreamableHTTPClientTransport(new URL(baseUrl)));
console.log("Connected using Streamable HTTP transport");


const toolsResult = await mcpClient.listTools(); //it returns all tools available in the mcp server
const tools = toolsResult.tools.map((tool)=>{
    return{
        name: tool.name,
        description : tool.description,
        parameters : tool.inputSchema as any
    }
}) // this is because we have to pass the tools to ai
console.log(
      "Connected to server with tools:",
      tools.map(({ name }) => name)
);


const processQuery= async(query : string)=>{
    const message : {role : string, parts : {text : string}[]}  =
        {
            role : "user",
            parts : [{text : query}]
        }
    const chat = ai.chats.create({
        model : "gemini-2.0-flash",
        history : messages,
        config :{
            tools : [
                {
                    functionDeclarations : tools,
                }
            ]
        }
    })
    const response = await chat.sendMessage({
        message : query 
    })
    
    //if we call a tool like we write => sum of 3 and 4 
    //this will call the function => but ai can't directly call this tool 
    //if response.candidates[0].content.parts[0] contains functionCall means a function is called else the ai has just replied 
    if(!response.candidates ||!response.candidates[0].content?.parts)return;

    let text:string|undefined;

    if(response.candidates[0].content.parts[0].functionCall){
        const toolName = response.candidates[0].content.parts[0].functionCall; // the function called
        const ans = await mcpClient.callTool({name : toolName?.name + "",arguments : toolName.args});
        const answer : {type:string,text : string}[] = ans.content as any;

        text = answer[0].text;//the text we get after calling the function(tool)
    }else{
        text = response.text;
    }

    if(!text){
        return;
    }

    messages.push(message);
    const modelMessage = {
        role : "model",
        parts : [{text}]
    }
    messages.push(modelMessage); 
    console.log("AI :", text);
};

const chatLoop=async()=>{
    const rl = readline.createInterface({
        input : process.stdin,
        output : process.stdout
    }) //to read from command line

    console.log("MCP Client started !!");
    console.log("Type your queries or 'quit' to exit.\n");

    while(true){ // so that the chat keeps going on

        const message = await rl.question("\nYOU : "); // it'll contain what the user typed

        if(message.toLowerCase() === "quit"){
            break;
        }
        await processQuery(message);
    }
    rl.close();
}
chatLoop();