import { relations } from "drizzle-orm";
import { users, handleHistory } from "./users";
import { proofs, proofSlugHistory } from "./proofs";
import { assets, proofAssets, uploadSessions } from "./assets";
import { issuers, verificationRecords, verificationEvents } from "./verification";
import { reports } from "./trust";
import { analyticsEvents } from "./analytics";

export * from "./users";
export * from "./proofs";
export * from "./assets";
export * from "./verification";
export * from "./trust";
export * from "./analytics";

// ============================================================================
// Drizzle Relations
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  proofs: many(proofs),
  assets: many(assets),
  handleHistory: many(handleHistory),
  avatar: one(assets, {
    fields: [users.avatarAssetId],
    references: [assets.id],
  }),
}));

export const handleHistoryRelations = relations(handleHistory, ({ one }) => ({
  user: one(users, {
    fields: [handleHistory.userId],
    references: [users.id],
  }),
}));

export const proofsRelations = relations(proofs, ({ one, many }) => ({
  user: one(users, {
    fields: [proofs.userId],
    references: [users.id],
  }),
  issuer: one(issuers, {
    fields: [proofs.issuerId],
    references: [issuers.id],
  }),
  proofAssets: many(proofAssets),
  slugHistory: many(proofSlugHistory),
  verificationRecords: many(verificationRecords),
  verificationEvents: many(verificationEvents),
}));

export const proofSlugHistoryRelations = relations(proofSlugHistory, ({ one }) => ({
  proof: one(proofs, {
    fields: [proofSlugHistory.proofId],
    references: [proofs.id],
  }),
  user: one(users, {
    fields: [proofSlugHistory.userId],
    references: [users.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  owner: one(users, {
    fields: [assets.ownerId],
    references: [users.id],
  }),
  proofAssets: many(proofAssets),
}));

export const proofAssetsRelations = relations(proofAssets, ({ one }) => ({
  proof: one(proofs, {
    fields: [proofAssets.proofId],
    references: [proofs.id],
  }),
  asset: one(assets, {
    fields: [proofAssets.assetId],
    references: [assets.id],
  }),
}));

export const uploadSessionsRelations = relations(uploadSessions, ({ one }) => ({
  owner: one(users, {
    fields: [uploadSessions.ownerId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [uploadSessions.assetId],
    references: [assets.id],
  }),
}));

export const issuersRelations = relations(issuers, ({ one, many }) => ({
  creator: one(users, {
    fields: [issuers.createdBy],
    references: [users.id],
  }),
  proofs: many(proofs),
}));

export const verificationRecordsRelations = relations(verificationRecords, ({ one }) => ({
  proof: one(proofs, {
    fields: [verificationRecords.proofId],
    references: [proofs.id],
  }),
}));

export const verificationEventsRelations = relations(verificationEvents, ({ one }) => ({
  proof: one(proofs, {
    fields: [verificationEvents.proofId],
    references: [proofs.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterUserId],
    references: [users.id],
  }),
}));

export const analyticsEventsRelations = relations(analyticsEvents, ({ one }) => ({
  profileUser: one(users, {
    fields: [analyticsEvents.profileUserId],
    references: [users.id],
  }),
  proof: one(proofs, {
    fields: [analyticsEvents.proofId],
    references: [proofs.id],
  }),
}));
