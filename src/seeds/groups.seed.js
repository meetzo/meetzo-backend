// Seeds default public groups. Safe to re-run: existing groups are skipped.
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import UserModel from "../models/userModel.js";
import { Group, GroupMember, GroupMessage } from "../models/groups.model.js";
import { encrypt } from "../utils/encryption.js";

const DEFAULT_GROUPS = [
  { name: "Welcome to Meetzo", description: "Say hi and meet new people", category: "General" },
  { name: "Travel Buddies", description: "Plan trips and share travel stories", category: "Travel" },
  { name: "Foodies", description: "Restaurants, recipes and food talk", category: "Food" },
  { name: "Fitness & Wellness", description: "Workouts, health and motivation", category: "Fitness" },
  { name: "Music Lovers", description: "Share what you are listening to", category: "Music" },
];

const seedGroups = async () => {
  await connectDB();

  const admin = await UserModel.findOne({ role: "ADMIN" }).select("_id");
  if (!admin) throw new Error("No ADMIN user found. Create one before seeding groups.");

  for (const data of DEFAULT_GROUPS) {
    const exists = await Group.exists({ name: data.name, isDefault: true });
    if (exists) {
      console.log(`skip: ${data.name}`);
      continue;
    }

    const group = await Group.create({
      ...data,
      type: "public",
      status: "ACTIVE",
      isDefault: true,
      ownerID: admin._id,
      membercount: 1,
    });

     await GroupMember.create({ groupID: group._id, userID: admin._id, role: "owner" });

    const systemMessage = await GroupMessage.create({
      groupID: group._id,
      senderID: null,
      messageType: "system",
      message: encrypt("Group created successfully"),
      systemEvent: { type: "GROUP_CREATED", actorId: admin._id },
    });

    group.lastmessageID = systemMessage._id;
    group.lastmessagedate = systemMessage.createdAt;
    await group.save();

    console.log(`created: ${data.name}`);
  }
};

seedGroups()
  .then(() => console.log("Group seeding done"))
  .catch((error) => {
    console.error("Group seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
