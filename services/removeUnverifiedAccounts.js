import cron from "node-cron";
import User from "../models/user.js";

const removeUnverifiedUsers = () => {
    cron.schedule("*/10 * * * *", async () => { // automation after every 10 minutes
        console.log("Checking for unverified accounts...");

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        try {
            const result = await User.deleteMany({
                accountVerified: false,
                createdAt: { $lt: thirtyMinutesAgo },
            });

            if (result.deletedCount > 0) {
                console.log(`Deleted ${result.deletedCount} unverified accounts.`);
            } else {
                console.log("No unverified accounts to delete.");
            }
        } catch (error) {
            console.error("Error deleting unverified accounts:", error);
        }
    });

    console.log("Cron job for deleting unverified accounts started..."); // see this is terminal 
};

export default removeUnverifiedUsers;
