CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"document_id" uuid,
	"annotation" text DEFAULT '' NOT NULL,
	"search" boolean DEFAULT true NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pending_request_id" uuid,
	"pending_since" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_conversations_owner_updated_idx" ON "chat_conversations" USING btree ("owner_id","updated_at");