import app from "./app";
import config from "./app/config";
import { transporter } from "./app/libs/nodemailer";
import { prisma } from "./app/libs/prisma";
import { redisClient } from "./app/libs/redis";

const PORT = config.port;

const main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");
    await redisClient.connect();
    console.log("redis Connected successfully ");
    await transporter.verify();
    console.log(" Connected successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting the server:", error);

    process.exit(1);
  }
};

main();
