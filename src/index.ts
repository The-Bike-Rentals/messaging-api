import cors from "cors";
import express, { type Request, type Response } from "express";
import routes from "./routes";
import { init } from "./whatsapp";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/", routes);
app.all("*", (_: Request, res: Response) => res.status(404).json({ error: "URL not found" }));

const port = Number(process.env.PORT ?? 3000);

(async () => {
	await init();
	app.listen(port, () => {
		console.log(`[server]: Server is running at ${port}`);
	});
})();
