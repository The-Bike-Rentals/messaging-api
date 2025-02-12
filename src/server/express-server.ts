import express from "express";
import type { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import routes from "@/routes";
import multer from "multer";

export class ExpressServer {
	private app: Application;

	constructor() {
		this.app = express();
		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandler();
	}

	private setupMiddleware() {
		this.app.use(cors());
		this.app.use(express.json());
	}

	private setupRoutes() {
		this.app.use("/", routes);

		this.app.all("*", (_: Request, res: Response) =>
			res.status(404).json({ error: "URL not found" }),
		);
	}

	private setupErrorHandler() {
		this.app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
			if (err instanceof multer.MulterError) {
				// Multer-specific errors
				return res.status(400).json({ error: `Multer error: ${err.message}` });
			}
			if (err instanceof SyntaxError && "body" in err) {
				return res.status(400).json({ error: "Invalid JSON payload" });
			}
			if (err) {
				console.error("Unexpected error:", err);
				return res.status(500).json({ error: "Internal Server Error" });
			}
			next();
		});
	}


	public getApp(): Application {
		return this.app;
	}
}
