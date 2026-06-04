export default async (request, context) => {
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-target-url"
  };

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Get target URL from header
  const targetUrl = request.headers.get("x-target-url");
  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "Missing x-target-url header." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    if (method === "GET") {
      // Forward GET request with search parameters
      const forwardUrl = new URL(targetUrl);
      // Append query params from the incoming request
      for (const [key, value] of url.searchParams.entries()) {
        forwardUrl.searchParams.set(key, value);
      }

      console.log(`Proxying GET request to: ${forwardUrl.toString()}`);
      const res = await fetch(forwardUrl.toString());
      const data = await res.text();

      return new Response(data, {
        status: res.status,
        headers: {
          ...corsHeaders,
          "Content-Type": res.headers.get("Content-Type") || "application/json"
        }
      });
    }

    if (method === "POST") {
      console.log(`Proxying POST request to: ${targetUrl}`);
      const requestBody = await request.text();

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: requestBody
      });
      const data = await res.text();

      return new Response(data, {
        status: res.status,
        headers: {
          ...corsHeaders,
          "Content-Type": res.headers.get("Content-Type") || "application/json"
        }
      });
    }
  } catch (err) {
    console.error("Proxy error:", err);
    return new Response(JSON.stringify({ error: `Proxy failed: ${err.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed." }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};
