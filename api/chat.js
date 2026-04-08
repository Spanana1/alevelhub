export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_KEY environment variable is not set' });
  }

  const { model, contents, maxTokens, stream } = req.body;

  if (!model || !contents) {
    return res.status(400).json({ error: 'Missing model or contents' });
  }

  const endpoint = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}&key=${GEMINI_KEY}`;

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens || 1000,
      temperature: 0.4,
    },
  };

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Forward status
    res.status(geminiRes.status);

    if (stream) {
      // Forward headers for SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = geminiRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } else {
      const data = await geminiRes.json();
      res.json(data);
    }
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message || 'Proxy fetch failed' });
  }
}
