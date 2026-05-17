// Vercel Edge Function – proxy Groq API
// Cheia stă pe server, userii nu o văd niciodată.
export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY not configured on server" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();

  const groqResponse = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: body.model || "llama-3.3-70b-versatile",
        messages: body.messages,
        stream: true,
        temperature: 0.3,
        max_tokens: 1024,
      }),
    }
  );

  if (!groqResponse.ok) {
    const err = await groqResponse.text();
    return new Response(JSON.stringify({ error: err }), {
      status: groqResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Stream direct către client
  return new Response(groqResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
