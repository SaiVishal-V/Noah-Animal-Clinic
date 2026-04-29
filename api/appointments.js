export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      const data = req.body;

      const response = await fetch(
        process.env.SUPABASE_URL + "/rest/v1/appointments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": process.env.SUPABASE_KEY,
            "Authorization": `Bearer ${process.env.SUPABASE_KEY}`,
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            ...data,
            status: "pending"
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error("Supabase error:", result);
        return res.status(500).json({ error: result.message || result });
      }

      return res.status(200).json({ success: true, data: result });

    } catch (err) {
      console.error("Server error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
