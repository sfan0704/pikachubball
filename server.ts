import express from "express";
import path from "path";
import { configureApp } from "./server/app";
import { serveStatic } from "./server/config/vite";
import { errorHandler } from "./server/middleware/error-handler";

const app = express();

configureApp(app);
serveStatic(app, path.resolve(process.cwd(), "public"));
app.use(errorHandler);

export default app;
