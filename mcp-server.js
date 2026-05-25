import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";

// Ensure process is configured
const SHEETS_URL = process.env.SHEETS_URL;
const MCP_AUTH_KEY = process.env.MCP_AUTH_KEY;

// 1. Helper Database Sync Functions
async function pullState() {
  if (!SHEETS_URL) {
    throw new Error("SHEETS_URL environment variable is not defined.");
  }
  const url = `${SHEETS_URL}?action=pull`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to pull database from Google Sheet: ${response.statusText}`);
  }
  return await response.json();
}

async function pushState(state) {
  if (!SHEETS_URL) {
    throw new Error("SHEETS_URL environment variable is not defined.");
  }
  const response = await fetch(SHEETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "push",
      ...state
    })
  });
  if (!response.ok) {
    throw new Error(`Failed to push database to Google Sheet: ${response.statusText}`);
  }
  return await response.json();
}

// 2. Initialize MCP Server
const server = new Server(
  {
    name: "atomicflow-coach",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// 3. Define Tools List
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_habits_and_tasks",
        description: "Retrieve all active habits, identity blueprints, stack triggers, and carry-forward focus tasks.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_wellbeing_and_sleep_analytics",
        description: "Fetch historical daily logs containing journal reflections, sleep metrics (duration, quality, bedtime, wakeup), and mood/energy levels to analyze wellbeing trends.",
        inputSchema: {
          type: "object",
          properties: {
            days: {
              type: "integer",
              description: "Number of past days of logs to fetch (default: 7).",
              minimum: 1,
              maximum: 30
            }
          }
        }
      },
      {
        name: "save_focus_task",
        description: "Create a new daily focus task, or toggle the completion status of an existing focus task. (Note: Completed focus tasks will be marked for satisfying deletion by the client app).",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text of the one-off focus task (e.g. 'Wash sheets', 'Buy fresh soap')."
            },
            completed: {
              type: "boolean",
              description: "The completion state of the task."
            },
            active: {
              type: "boolean",
              description: "The active state of the task. Set false to delete."
            },
            id: {
              type: "string",
              description: "The unique ID of the task (omit when adding a new task)."
            }
          },
          required: ["text"]
        }
      },
      {
        name: "save_habit_routine",
        description: "Forge a brand new routine habit or update details of an existing habit.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The unique ID of the habit (omit when creating a new one)."
            },
            name: {
              type: "string",
              description: "The action name of the habit (e.g. 'Bedroom resets', 'Personal Hygiene refresh')."
            },
            category: {
              type: "string",
              description: "Category of the routine ('health', 'mind', 'work')."
            },
            timeOfDay: {
              type: "string",
              description: "Routines time of day ('morning' or 'evening')."
            },
            identity: {
              type: "string",
              description: "The identity pillar this habit reinforces (e.g., 'A clean, self-respecting person')."
            },
            cue: {
              type: "string",
              description: "The obvious visual cue to trigger execution."
            },
            reward: {
              type: "string",
              description: "The immediate satisfying reward."
            },
            twoMinuteVersion: {
              type: "string",
              description: "A super low-friction 2-minute alternative version of the habit."
            },
            stackTrigger: {
              type: "string",
              description: "The immediate preceding trigger (Habit Stack: 'After I [Trigger Cue], I will [Habit]')."
            }
          },
          required: ["name", "identity", "cue", "reward", "twoMinuteVersion"]
        }
      },
      {
        name: "save_journal_entry",
        description: "Save daily reflections, emotional baseline ratings, sleep timings, sleep quality, daily wins list, and tomorrow's main improvement target.",
        inputSchema: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "The target date in YYYY-MM-DD format."
            },
            mood: {
              type: "integer",
              description: "Mood rating on a scale of 1 to 5.",
              minimum: 1,
              maximum: 5
            },
            energy: {
              type: "integer",
              description: "Energy level on a scale of 1 to 5.",
              minimum: 1,
              maximum: 5
            },
            journalNotes: {
              type: "string",
              description: "Detailed daily reflection text."
            },
            wins: {
              type: "array",
              items: { type: "string" },
              description: "List of satisfying accomplishments or wins."
            },
            improvement: {
              type: "string",
              description: "Intention or 1% adjustment area for tomorrow."
            },
            sleepBedtime: {
              type: "string",
              description: "Bedtime in 24-hour HH:MM format."
            },
            sleepWakeup: {
              type: "string",
              description: "Wakeup time in 24-hour HH:MM format."
            },
            sleepQuality: {
              type: "integer",
              description: "Subjective sleep quality index (1 = Restless, 2 = Average, 3 = Refreshed).",
              minimum: 1,
              maximum: 3
            }
          },
          required: ["date", "mood", "energy"]
        }
      }
    ]
  };
});

// 4. Handle Tool Calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    
    // Check for SHEETS_URL configuration
    if (!SHEETS_URL) {
      return {
        content: [{ type: "text", text: "Error: The SHEETS_URL environment variable is not configured. Please supply a valid Google Web App URL." }],
        isError: true
      };
    }

    // Pull database state
    const state = await pullState();

    switch (name) {
      case "get_habits_and_tasks": {
        const activeHabits = (state.habits || []).filter(h => h.active !== false);
        const activeTasks = (state.tasks || []).filter(t => t.active !== false);
        const blueprints = state.blueprints || { identities: [], stacks: [] };
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              habits: activeHabits,
              tasks: activeTasks,
              blueprints: blueprints
            }, null, 2)
          }]
        };
      }

      case "get_wellbeing_and_sleep_analytics": {
        const limitDays = args?.days || 7;
        const logs = state.logs || {};
        
        // Sort dates descending and take the last N days
        const sortedDates = Object.keys(logs).sort().reverse().slice(0, limitDays);
        const filteredLogs = {};
        for (const date of sortedDates) {
          filteredLogs[date] = logs[date];
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              logs: filteredLogs,
              daysAnalyzed: limitDays
            }, null, 2)
          }]
        };
      }

      case "save_focus_task": {
        const tasks = state.tasks || [];
        const taskText = args.text;
        const isCompleted = args.completed ?? false;
        const isActive = args.active ?? true;
        const taskId = args.id;

        let targetTask;
        if (taskId) {
          const index = tasks.findIndex(t => t.id === taskId);
          if (index !== -1) {
            tasks[index] = {
              ...tasks[index],
              text: taskText || tasks[index].text,
              completed: isCompleted,
              active: isActive,
              updatedAt: Date.now()
            };
            targetTask = tasks[index];
          } else {
            return {
              content: [{ type: "text", text: `Error: Task with ID ${taskId} not found.` }],
              isError: true
            };
          }
        } else {
          targetTask = {
            id: 't_' + Date.now(),
            text: taskText,
            completed: isCompleted,
            active: isActive,
            date: new Date().toISOString().split('T')[0],
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          tasks.push(targetTask);
        }

        state.tasks = tasks;
        await pushState(state);

        return {
          content: [{
            type: "text",
            text: `Success: Daily focus task saved successfully.\n${JSON.stringify(targetTask, null, 2)}`
          }]
        };
      }

      case "save_habit_routine": {
        const habits = state.habits || [];
        const habitId = args.id;
        
        let targetHabit;
        if (habitId) {
          const index = habits.findIndex(h => h.id === habitId);
          if (index !== -1) {
            habits[index] = {
              ...habits[index],
              ...args,
              updatedAt: Date.now()
            };
            targetHabit = habits[index];
          } else {
            return {
              content: [{ type: "text", text: `Error: Habit with ID ${habitId} not found.` }],
              isError: true
            };
          }
        } else {
          targetHabit = {
            ...args,
            id: 'h_' + Date.now(),
            active: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          habits.push(targetHabit);
        }

        state.habits = habits;
        await pushState(state);

        return {
          content: [{
            type: "text",
            text: `Success: Blueprint routine habit saved successfully.\n${JSON.stringify(targetHabit, null, 2)}`
          }]
        };
      }

      case "save_journal_entry": {
        const logs = state.logs || {};
        const dateStr = args.date;

        logs[dateStr] = {
          ...(logs[dateStr] || { completions: {} }),
          ...args,
          date: dateStr,
          updatedAt: Date.now()
        };

        state.logs = logs;
        await pushState(state);

        return {
          content: [{
            type: "text",
            text: `Success: Journal log for ${dateStr} saved successfully.\n${JSON.stringify(logs[dateStr], null, 2)}`
          }]
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool execution: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error executing tool: ${error.message}` }],
      isError: true
    };
  }
});

// 5. Setup Server Transports
const isSseMode = process.argv.includes("--sse") || process.argv.includes("-sse");

if (isSseMode) {
  // Start Express SSE Server
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  // 1. Enable CORS Middleware for Browser-based Claude.ai Connectors
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-mcp-auth-key");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Track active stateful transport sessions in memory
  const activeTransports = new Map();

  // 2. GET Endpoint: Establish SSE Stream
  app.get("/sse", (req, res) => {
    // Verify Security Token
    if (MCP_AUTH_KEY) {
      const authHeader = req.headers.authorization;
      const authQuery = req.query.auth_key;
      const expectedAuth = `Bearer ${MCP_AUTH_KEY}`;
      
      if (authHeader !== expectedAuth && authQuery !== MCP_AUTH_KEY) {
        return res.status(401).json({ error: "Unauthorized: Invalid or missing authentication key." });
      }
    }

    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    activeTransports.set(sessionId, transport);

    server.connect(transport).catch(err => {
      console.error(`SSE Connection error on session ${sessionId}:`, err);
      activeTransports.delete(sessionId);
    });

    req.on("close", () => {
      activeTransports.delete(sessionId);
    });
  });

  // 3. POST Endpoint: Handle Tool Call Messages
  app.post("/messages", express.json(), async (req, res) => {
    const connectionId = req.query.connection_id;

    // Validate that the request session was authenticated during the SSE GET handshake
    if (MCP_AUTH_KEY) {
      if (!connectionId || !activeTransports.has(connectionId)) {
        // Fallback to header verification if connection_id is missing/unregistered
        const authHeader = req.headers.authorization;
        const expectedAuth = `Bearer ${MCP_AUTH_KEY}`;
        if (authHeader !== expectedAuth) {
          return res.status(401).json({ error: "Unauthorized: Invalid or missing connection session." });
        }
      }
    }

    const transport = activeTransports.get(connectionId);
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).json({ error: "Active SSE connection not found." });
    }
  });

  app.listen(PORT, () => {
    console.log(`[AtomicFlow Custom MCP Server] Running stateful SSE mode on port ${PORT}`);
    console.log(`[Google Sync Settings] Sheets endpoint active: ${SHEETS_URL ? "Configured" : "NOT CONFIGURED"}`);
    if (MCP_AUTH_KEY) {
      console.log(`[Security] Auth Key security verification: ENABLED`);
    } else {
      console.log(`[Security] Auth Key security verification: DISABLED (Highly recommend setting MCP_AUTH_KEY)`);
    }
  });
} else {
  // Start standard Stdio transport (Perfect for Local execution!)
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  console.error("[AtomicFlow Custom MCP Server] Running in local Stdio mode");
}
