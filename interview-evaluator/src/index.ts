import express from "express";
import { env } from "./config/env.js";

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
