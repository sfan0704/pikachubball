import express from "express";
import { configureApp } from "../server/http/app";
import { createAppErrorHandler, createServerDependencies } from "../server/http/composition-root";
import { loadConfig } from "../server/config/config";

const dependencies = createServerDependencies(loadConfig());
const app = express();

configureApp(app, dependencies);
app.use(createAppErrorHandler(dependencies));

export default app;
