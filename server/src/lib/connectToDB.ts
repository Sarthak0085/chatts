import mongoose from "mongoose";

const connectToDB = async () => {
	try {
		const data = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chat-app');
		console.log("Connected to MongoDB : " + data.connection.host);
	} catch (error: any) {
		console.log("Error connecting to MongoDB", error.message);
	}
};

export default connectToDB;