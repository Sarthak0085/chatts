import cookieParser from "cookie-parser";
import express, { json, NextFunction, Request, Response } from "express";
import morgan from "morgan";
import { errorMiddleware } from "./middlewares/error";
import router from "./routes";
import cors, { CorsOptions } from "cors";
import { corsOptions } from "./constants/config";

const app = express();

//middlewares
app.use(express.json({ limit: "50mb" }));

app.use(morgan('tiny'));
app.use(json({
    limit: "200mb"
}));

app.use(cors(corsOptions as CorsOptions));

//remove it in production
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use("/api/v1", router);

// Default Route Handling
app.get("/", (req, res) => {
    res.status(200).send("Server is Ok");
});

// Handling 404 Errors
app.all("*", (req: Request, res: Response, next: NextFunction) => {
    const err = new Error(`Route ${req.originalUrl} not found`);
    next(err);
});

app.use(errorMiddleware);

export default app;
