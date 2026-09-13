import express from "express";
import { configureApp } from "../server/app";
import { errorHandler } from "../server/middleware/error-handler";

const app = express();

configureApp(app);
app.use(errorHandler);

export default app;
