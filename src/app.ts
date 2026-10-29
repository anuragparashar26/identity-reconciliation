import express from "express";
import routes from "./routes";

const app = express();

app.use(express.json());
app.set("json spaces", 2);

app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Identity Reconciliation Service" });
});

app.use(routes);

export default app;
