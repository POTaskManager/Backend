-- Enable citext extension
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "projectaccess" (
    "pac_accessid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pac_userid" UUID NOT NULL,
    "pac_projectid" UUID NOT NULL,
    "pac_role" VARCHAR(50),
    "pac_invited_at" TIMESTAMP(6),
    "pac_accepted" BOOLEAN DEFAULT false,
    "pac_created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "pac_role_id" UUID,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "projectaccess_pkey" PRIMARY KEY ("pac_accessid")
);

-- CreateTable
CREATE TABLE "projects" (
    "proj_projid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proj_name" VARCHAR(255) NOT NULL,
    "proj_db_namespace" VARCHAR(255) NOT NULL,
    "proj_created_by" UUID,
    "proj_created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "proj_description" TEXT,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("proj_projid")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_roleid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_roleid")
);

-- CreateTable
CREATE TABLE "sessions" (
    "session_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "refresh_token_hash" TEXT,
    "expires_at" TIMESTAMP(6),
    "last_seen_at" TIMESTAMP(6),
    "revoked" BOOLEAN DEFAULT false,
    "user_agent" TEXT,
    "ip_address" INET,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "user_identities" (
    "identity_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "provider" VARCHAR(100) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "provider_email" CITEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "email_verified" BOOLEAN DEFAULT false,
    "display_name" VARCHAR(255),
    "avatar_url" TEXT,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("identity_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_userid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_email" CITEXT NOT NULL,
    "user_password_hash" VARCHAR(255) NOT NULL,
    "user_name" VARCHAR(100),
    "user_created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "user_email_verified" BOOLEAN DEFAULT false,
    "last_login" TIMESTAMP(6),
    "is_active" BOOLEAN DEFAULT true,
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_userid")
);

-- CreateTable
CREATE TABLE "usersettings" (
    "uset_settingsid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uset_userid" UUID,
    "uset_theme" VARCHAR(50),
    "uset_language" VARCHAR(10),
    "uset_notifications_enabled" BOOLEAN DEFAULT true,

    CONSTRAINT "usersettings_pkey" PRIMARY KEY ("uset_settingsid")
);

-- CreateTable
CREATE TABLE "projectaccess_audit" (
    "audit_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pac_accessid" UUID,
    "project_id" UUID,
    "user_id" UUID,
    "operation" VARCHAR(20),
    "changed_by" UUID,
    "changed_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "changed_fields" JSONB,
    "old" JSONB,
    "new" JSONB,

    CONSTRAINT "projectaccess_audit_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "refresh_token_blacklist" (
    "token_hash" TEXT NOT NULL,
    "session_id" UUID,
    "blacklisted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6),
    "reason" TEXT,

    CONSTRAINT "refresh_token_blacklist_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "user_audit" (
    "audit_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "operation" VARCHAR(20),
    "changed_by" UUID,
    "changed_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "changed_fields" JSONB,
    "old" JSONB,
    "new" JSONB,

    CONSTRAINT "user_audit_pkey" PRIMARY KEY ("audit_id")
);

-- CreateIndex
CREATE INDEX "idx_projectaccess_project" ON "projectaccess"("pac_projectid");

-- CreateIndex
CREATE INDEX "idx_projectaccess_user" ON "projectaccess"("pac_userid");

-- CreateIndex
CREATE UNIQUE INDEX "projects_proj_db_namespace_key" ON "projects"("proj_db_namespace");

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_userid_key" ON "user_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_email_key" ON "users"("user_email");

-- CreateIndex
CREATE INDEX "idx_pac_audit_project" ON "projectaccess_audit"("project_id");

-- CreateIndex
CREATE INDEX "idx_pac_audit_user" ON "projectaccess_audit"("user_id");

-- AddForeignKey
ALTER TABLE "projectaccess" ADD CONSTRAINT "projectaccess_pac_projectid_fkey" FOREIGN KEY ("pac_projectid") REFERENCES "projects"("proj_projid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "projectaccess" ADD CONSTRAINT "projectaccess_pac_role_id_fkey" FOREIGN KEY ("pac_role_id") REFERENCES "roles"("role_roleid") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "projectaccess" ADD CONSTRAINT "projectaccess_pac_userid_fkey" FOREIGN KEY ("pac_userid") REFERENCES "users"("user_userid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_proj_created_by_fkey" FOREIGN KEY ("proj_created_by") REFERENCES "users"("user_userid") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userid_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_userid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_userid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usersettings" ADD CONSTRAINT "usersettings_uset_userid_fkey" FOREIGN KEY ("uset_userid") REFERENCES "users"("user_userid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "projectaccess_audit" ADD CONSTRAINT "projectaccess_audit_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("proj_projid") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "projectaccess_audit" ADD CONSTRAINT "projectaccess_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_userid") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_token_blacklist" ADD CONSTRAINT "refresh_token_blacklist_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_audit" ADD CONSTRAINT "user_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_userid") ON DELETE SET NULL ON UPDATE NO ACTION;
