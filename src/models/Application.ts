import mongoose, { Schema, Document, Types } from 'mongoose';
import type { Stage } from '@/lib/workflow';

export type AppStatus = 'pending' | 'approved' | 'rejected';
export type AppStage = Stage;

// One entry per workflow decision (PRD WF-1): who, role, when, what, remark, signature.
export interface IApprovalStep {
  fromStage: string;
  toStage: string;
  action: string;
  actorId: Types.ObjectId;
  actorName: string;
  actorRole: string;
  remark?: string;
  signature?: string;
  at: Date;
}

export interface IApplication extends Document {
  userId: Types.ObjectId;
  applicantName: string;
  startupName: string;
  idea: string;
  industry: string;
  pitchDeckUrl?: string;
  pitchDeckName?: string;
  status: AppStatus;
  stage: AppStage;
  steps: IApprovalStep[];
  rejectedBy?: string;
  rejectionReason?: string;
  isFastTracked: boolean;
  isPublic: boolean;
  isEditable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalStepSchema = new Schema<IApprovalStep>(
  {
    fromStage: { type: String, required: true },
    toStage:   { type: String, required: true },
    action:    { type: String, required: true },
    actorId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    remark:    { type: String },
    signature: { type: String },
    at:        { type: Date, default: Date.now },
  },
  { _id: false }
);

const ApplicationSchema = new Schema<IApplication>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    applicantName: { type: String, required: true },
    startupName:   { type: String, required: true, trim: true },
    idea:          { type: String, required: true },
    industry:      { type: String, required: true },
    pitchDeckUrl:  { type: String },
    pitchDeckName: { type: String },
    status:        { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
    stage:         { type: String, enum: ['submitted','executive_accepted','manager_reviewed','sr_manager_approved','ceo_approved','rejected'], default: 'submitted' },
    steps:         { type: [ApprovalStepSchema], default: [] },
    rejectedBy:    { type: String },
    rejectionReason:{ type: String },
    isFastTracked: { type: Boolean, default: false },
    isPublic:      { type: Boolean, default: false },
    isEditable:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Application =
  mongoose.models.Application ||
  mongoose.model<IApplication>('Application', ApplicationSchema);
