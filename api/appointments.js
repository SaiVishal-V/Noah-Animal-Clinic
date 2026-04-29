export default async function handler(req, res) {
  if (req.method === "POST") {
    const data = req.body;

    // send to Supabase
    const response = await fetch(process.env.SUPABASE_URL + "/rest/v1/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_KEY}`
      },
      body: JSON.stringify({
        ...data,
        status: "pending"
      })
    });

    return res.status(200).json({ message: "Appointment requested" });
  }
}
