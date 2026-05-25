import { Buffer } from "buffer";

// Ensure process is configured
const SHEETS_URL = process.env.SHEETS_URL;
const MCP_AUTH_KEY = process.env.MCP_AUTH_KEY;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

// 2. Upstash Redis REST Helpers
async function redisPush(connectionId, payload) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis connection variables are not defined.");
  }
  const url = `${UPSTASH_REDIS_REST_URL}/rpush/responses:${connectionId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

async function redisPop(connectionId) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis connection variables are not defined.");
  }
  const url = `${UPSTASH_REDIS_REST_URL}/lpop/responses:${connectionId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${UPSTASH_REDIS_REST_TOKEN}`
    }
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result.result || null; // Upstash returns value in .result field
}

// 3. Define Tools Metadata
const TOOLS = [
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
    description: "Create a new daily focus task, or toggle the completion status of an existing focus task.",
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
];

// 4. Handle Stateless JSON-RPC MCP Requests
async function handleMcpRequest(body) {
  const { method, params, id } = body;

  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: { tools: TOOLS }
    };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    
    if (!SHEETS_URL) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32001,
          message: "SHEETS_URL environment variable is not defined."
        }
      };
    }

    try {
      const state = await pullState();

      switch (name) {
        case "get_habits_and_tasks": {
          const activeHabits = (state.habits || []).filter(h => h.active !== false);
          const activeTasks = (state.tasks || []).filter(t => t.active !== false);
          const blueprints = state.blueprints || { identities: [], stacks: [] };
          
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: "text",
                text: JSON.stringify({ habits: activeHabits, tasks: activeTasks, blueprints }, null, 2)
              }]
            }
          };
        }

        case "get_wellbeing_and_sleep_analytics": {
          const limitDays = args?.days || 7;
          const logs = state.logs || {};
          const sortedDates = Object.keys(logs).sort().reverse().slice(0, limitDays);
          
          const filteredLogs = {};
          for (const date of sortedDates) {
            filteredLogs[date] = logs[date];
          }

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: "text",
                text: JSON.stringify({ logs: filteredLogs, daysAnalyzed: limitDays }, null, 2)
              }]
            }
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
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: `Task with ID ${taskId} not found.` }
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
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: "text",
                text: `Success: Focus task saved successfully.\n${JSON.stringify(targetTask, null, 2)}`
              }]
            }
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
                jsonrpc: "2.0",
                id,
                error: { code: -32602, message: `Habit with ID ${habitId} not found.` }
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
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: "text",
                text: `Success: Habit routine saved successfully.\n${JSON.stringify(targetHabit, null, 2)}`
              }]
            }
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
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: "text",
                text: `Success: Journal log saved successfully.\n${JSON.stringify(logs[dateStr], null, 2)}`
              }]
            }
          };
        }

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${name}` }
          };
      }
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: `Internal handler error: ${err.message}` }
      };
    }
  }

  // Base fallback
  return {
    jsonrpc: "2.0",
    id,
    result: {}
  };
}

// 5. Netlify Serverless Function Handler (V2 Signature)
export default async (request, context) => {
  const url = new URL(request.url);
  const method = request.method;

  // Verify MCP Security Token if configured
  if (MCP_AUTH_KEY) {
    const authHeader = request.headers.get("authorization");
    const authQuery = url.searchParams.get("auth_key");
    const expectedAuth = `Bearer ${MCP_AUTH_KEY}`;
    
    if (authHeader !== expectedAuth && authQuery !== MCP_AUTH_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or missing authentication key." }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // --- GET REQUEST: ESTABLISH SSE TRANSPORT STREAM ---
  if (method === "GET") {
    const connectionId = "conn_" + Date.now() + Math.random().toString(36).substring(2, 7);
    const clientEndpoint = `${url.origin}${url.pathname}?connection_id=${connectionId}`;

    const stream = new ReadableStream({
      async start(controller) {
        // Enqueue connection handshake
        controller.enqueue(new TextEncoder().encode(`event: endpoint\ndata: ${clientEndpoint}\n\n`));

        // Start Upstash Broker Polling Loop (Max 24 seconds to prevent Netlify timeout crash)
        const startTime = Date.now();
        const maxDuration = 24000; // 24 seconds

        const pollInterval = setInterval(async () => {
          if (Date.now() - startTime > maxDuration) {
            clearInterval(pollInterval);
            try {
              controller.close();
            } catch (e) {}
            return;
          }

          try {
            // Check Redis responses queue
            const responsePayload = await redisPop(connectionId);
            if (responsePayload) {
              controller.enqueue(new TextEncoder().encode(`event: message\ndata: ${responsePayload}\n\n`));
            }
          } catch (err) {
            console.error("Broker poll error:", err);
          }
        }, 200);

        // Clean up on cancel
        request.signal.addEventListener("abort", () => {
          clearInterval(pollInterval);
        });
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  }

  // --- POST REQUEST: EXECUTE TOOL AND WRITE TO SSE BROKER ---
  if (method === "POST") {
    const connectionId = url.searchParams.get("connection_id");
    if (!connectionId) {
      return new Response(JSON.stringify({ error: "Missing connection_id query parameter." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const requestBody = await request.json();
      
      // Execute the stateless JSON-RPC call
      const responseBody = await handleMcpRequest(requestBody);

      // Write response into Upstash Redis queue for the GET connection stream to read
      await redisPush(connectionId, JSON.stringify(responseBody));

      return new Response(null, { status: 200 });
    } catch (err) {
      return new Response(JSON.stringify({ error: `POST execution failed: ${err.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed." }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
};
