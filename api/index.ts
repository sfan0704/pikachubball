import express from "express";
import { configureApp } from "../server/app";
import { createAppErrorHandler, createServerDependencies } from "../server/composition-root";
import { loadConfig } from "../server/config/config";

const dependencies = createServerDependencies(loadConfig());
const app = express();

configureApp(app, dependencies);
app.use(createAppErrorHandler(dependencies));

export default app;
