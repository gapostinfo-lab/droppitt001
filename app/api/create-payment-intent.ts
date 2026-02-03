export const config = {
  runtime: "nodejs",
};

type ReqBody = {
  amount: number; // cents
  currency?: string;
  metadata?: Record<string, string>;
};

function send(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { error: "Method not allowed" });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return send(res, 500, { error: "Missing STRIPE_SECRET_KEY env var" });
    }

    const body: ReqBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (!body?.amount || typeof body.amount !== "number" || body.amount < 50) {
      return send(res, 400, { error: "Invalid amount (must be >= 50 cents)" });
    }

    const currency = body.currency || "usd";

    const form = new URLSearchParams();
    form.set("amount", String(Math.round(body.amount)));
    form.set("currency", currency);
    form.set("automatic_payment_methods[enabled]", "true");

    if (body.metadata) {
      for (const [k, v] of Object.entries(body.metadata)) {
        form.set(`metadata[${k}]`, String(v));
      }
    }

    const resp = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    const json = await resp.json();

    if (!resp.ok) {
      return send(res, 400, {
        error: json?.error?.message || "Stripe error",
        raw: json,
      });
    }

    return send(res, 200, { clientSecret: json.client_secret });
  } catch (e: any) {
    return send(res, 500, { error: e?.message || "Server error" });
  }
}
