import mongoose, { Schema, Document } from "mongoose";
import { Role } from "@/lib/auth";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: Role;
  createdAt: Date;
  isVerified: boolean;
  otp?: string;
  otpExpiresAt?: Date;
  image?: string;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    role: {
      type: String,
      enum: ["incubatee", "admin_it", "ceo", "sr_manager", "manager", "executive", "staff"],
      default: "incubatee",
    },
    image: { type: String },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpiresAt: { type: Date },
  },
  { timestamps: true },
);

export const User =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
