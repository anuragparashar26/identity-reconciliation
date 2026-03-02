//server

import express from "express";
import routes from "./routes";

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.set("json spaces", 2);

// health check
app.get("/", (_req, res) => {
    res.json({ status: "ok", message: "Identity Reconciliation Service" });
});

// api routes
app.use(routes);

// start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`POST /identify is ready to receive requests`);
});

export default app;
