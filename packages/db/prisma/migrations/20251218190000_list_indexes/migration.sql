-- Add indexes to support paginated list queries
CREATE INDEX IF NOT EXISTS "Table_venueId_isActive_idx" ON "Table"("venueId", "isActive");
CREATE INDEX IF NOT EXISTS "Order_venueId_createdAt_idx" ON "Order"("venueId", "createdAt");
CREATE INDEX IF NOT EXISTS "StaffUser_venueId_isActive_idx" ON "StaffUser"("venueId", "isActive");
CREATE INDEX IF NOT EXISTS "StaffUser_venueId_role_isActive_idx" ON "StaffUser"("venueId", "role", "isActive");
