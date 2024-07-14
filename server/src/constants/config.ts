const corsOptions = {
  origin: [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://localhost:5174",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

const CHATTS_TOKEN = "chat-token";

export { corsOptions, CHATTS_TOKEN };