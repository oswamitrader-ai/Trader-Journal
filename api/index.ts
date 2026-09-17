import express from "express";
import { apiRouter } from "../server/api";

const app = express();

app.use(express.json({ limit: "5mb" }));

// Handle API requests both at root and with /api prefix
app.use(apiRouter);

export default app;
